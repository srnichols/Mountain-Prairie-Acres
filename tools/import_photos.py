#!/usr/bin/env python3
"""Make web copies of drone photos and add them to data/photos.json, the list behind the Photo map page.

The originals stay where they are: they are 6-17 MB each and carry the exact GPS position, the drone's serial number, and more. For each
photo you pick, this writes a metadata-free WebP copy (1600 px on the long side) and a 400 px thumbnail to docs/images/, and adds a record
with the camera's place on the lot grid, its height, heading, tilt, and field of view, and an empty caption. The checker refuses empty
captions, so a photo you have not described yet cannot be published by mistake.

Usage:
  python tools/import_photos.py FOLDER --list           one line per photo: number, time, grid cell, height, heading, tilt
  python tools/import_photos.py FOLDER 3 10 65          import photos by number (the 4 digits before _D in DJI_<date><time>_<number>_D.JPG)
  python tools/import_photos.py FOLDER 65 --replace     write photo 65 again, keeping the caption you wrote

Pillow (pip install pillow) is needed only for the image copies and the lens; the positions need nothing extra.
"""
import argparse
import datetime
import json
import math
import pathlib
import re
import struct
import sys

from site_grid import M_TO_FT, SiteGrid

ROOT = pathlib.Path(__file__).resolve().parents[1]
DJI_NAME = re.compile(r"DJI_(\d{14})_(\d{4})_D\.JPG", re.IGNORECASE)
XMP_ATTRIBUTE = re.compile(r'drone-dji:(\w+)="([^"]*)"')
XMP_ELEMENT = re.compile(r"<drone-dji:(\w+)>([^<]*)<")
LARGE_PX, LARGE_QUALITY = 1600, 72
THUMB_PX, THUMB_QUALITY = 400, 68
# A shot from farther than this outside the fence cannot go on the lot map (the scenic and indoor shots were not taken here).
MAX_OFF_LOT_FT = 600
# The 35 mm-equivalent focal length is defined by the diagonal of the frame; a 4:3 photo is 0.8 of that diagonal wide.
HALF_DIAGONAL_MM, WIDTH_OF_DIAGONAL = 21.6333, 0.8
SOURCE = ("Drone photos taken by the owner in the fall of 2026. Each record places the camera on the master grid from the photo's GPS position "
          "(good to roughly 10 to 30 ft) and gives its height above the take-off point, the direction it faced, and its tilt; the web copies carry no metadata.")


def photo_number(name):
    """The 4-digit counter in a DJI file name, as an integer."""
    match = DJI_NAME.fullmatch(pathlib.Path(name).name)
    if not match:
        raise ValueError(f"{name} is not a DJI photo name like DJI_20261019175241_0065_D.JPG")
    return int(match.group(2))


def taken_from_name(name):
    """The local time the camera wrote into the file name, as YYYY-MM-DDTHH:MM:SS."""
    match = DJI_NAME.fullmatch(pathlib.Path(name).name)
    if not match:
        raise ValueError(f"{name} is not a DJI photo name like DJI_20261019175241_0065_D.JPG")
    return datetime.datetime.strptime(match.group(1), "%Y%m%d%H%M%S").isoformat()


def xmp_fields(blob):
    """The drone-dji values (position, heights, angles) in the XMP packet inside the first bytes of a photo, or {} when it has none."""
    start, end = blob.find(b"<x:xmpmeta"), blob.find(b"</x:xmpmeta>")
    if start < 0 or end < 0:
        return {}
    text = blob[start:end + len(b"</x:xmpmeta>")].decode("utf-8", "replace")
    fields = dict(XMP_ATTRIBUTE.findall(text))
    for key, value in XMP_ELEMENT.findall(text):
        fields.setdefault(key, value)
    return fields


def read_xmp(path):
    with open(path, "rb") as file:
        return xmp_fields(file.read(262144))


def field_of_view(focal_35mm):
    """The horizontal field of view in degrees of a 4:3 photo from a lens of this 35 mm-equivalent focal length."""
    if not focal_35mm or focal_35mm <= 0:
        raise ValueError("The photo has no 35 mm focal length, so its field of view is unknown")
    return round(2 * math.degrees(math.atan(WIDTH_OF_DIAGONAL * HALF_DIAGONAL_MM / focal_35mm)), 1)


def heading_of(yaw_degrees):
    """A gimbal yaw (-180 to 180, from true north, clockwise) as a compass heading from 0 to 359."""
    return round(yaw_degrees) % 360


def lens_35mm(path):
    """The 35 mm-equivalent focal length from the photo's EXIF data."""
    Image = _pillow()
    with Image.open(path) as image:
        return image.getexif().get_ifd(0x8769).get(0xA405)


def near_lot(grid, x, y):
    """Whether a point is close enough to the lot to go on the lot map."""
    fence = grid.data["lot"]["fence"]
    return -MAX_OFF_LOT_FT <= x <= fence["width"] + MAX_OFF_LOT_FT and -MAX_OFF_LOT_FT <= y <= fence["depth"] + MAX_OFF_LOT_FT


def camera_record(path, grid, focal_35mm):
    """The data record for one photo: where the camera was, how high, which way it faced, and what it saw. Captions are left for a person."""
    name = pathlib.Path(path).name
    number = photo_number(name)
    fields = read_xmp(path)
    try:
        latitude, longitude = float(fields["GpsLatitude"]), float(fields["GpsLongitude"])
        height_m, yaw, pitch = float(fields["RelativeAltitude"]), float(fields["GimbalYawDegree"]), float(fields["GimbalPitchDegree"])
    except (KeyError, ValueError) as error:
        raise ValueError(f"{name} has no DJI position and camera angles in its metadata") from error
    x, y = grid.from_latlon(latitude, longitude)
    if not near_lot(grid, x, y):
        raise ValueError(f"{name} was not taken near the lot (x {x:,.0f}, y {y:,.0f}), so it cannot go on the lot map")
    return {
        "id": f"dji_{number:04d}", "file": f"dji_{number:04d}.webp", "thumb": f"dji_{number:04d}_t.webp", "original": name,
        "taken": taken_from_name(name), "x": round(x, 1), "y": round(y, 1), "height_ft": max(0, round(height_m * M_TO_FT)),
        "heading": heading_of(yaw), "pitch": max(-90, min(90, round(pitch))), "fov": field_of_view(focal_35mm), "caption": "", "alt": "",
    }


def metadata_chunks(path):
    """The names of the EXIF, XMP, or color-profile chunks inside a WebP file; a web copy should have none."""
    found = []
    for name, _ in _webp_chunks(path):
        if name in ("EXIF", "XMP ", "ICCP"):
            found.append(name)
    return found


def _webp_chunks(path):
    """Each chunk of a WebP file as (four-letter name, data); the file must start with RIFF and WEBP."""
    with open(path, "rb") as file:
        header = file.read(12)
        if len(header) < 12 or header[:4] != b"RIFF" or header[8:12] != b"WEBP":
            raise ValueError(f"{path} is not a WebP file")
        while True:
            head = file.read(8)
            if len(head) < 8:
                return
            name, size = head[:4].decode("ascii", "replace"), struct.unpack("<I", head[4:])[0]
            data = file.read(size)
            if size & 1:
                file.read(1)
            yield name, data


def webp_size(path):
    """The (width, height) in pixels of a WebP file, read from its header; no image library is needed."""
    for name, data in _webp_chunks(path):
        if name == "VP8X" and len(data) >= 10:
            return int.from_bytes(data[4:7], "little") + 1, int.from_bytes(data[7:10], "little") + 1
        if name == "VP8L" and len(data) >= 5 and data[0] == 0x2F:
            bits = struct.unpack("<I", data[1:5])[0]
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        if name == "VP8 " and len(data) >= 10 and data[3:6] == b"\x9d\x01\x2a":
            return struct.unpack("<H", data[6:8])[0] & 0x3FFF, struct.unpack("<H", data[8:10])[0] & 0x3FFF
    raise ValueError(f"{path} has no image header")


def _pillow():
    try:
        from PIL import Image
    except ImportError as error:
        raise SystemExit("Pillow is needed to write the image copies: pip install pillow") from error
    return Image


def write_copies(source, large, thumb):
    """Write the 1600 px photo and the 400 px thumbnail as WebP, re-encoded from the pixels, so no metadata comes along."""
    Image = _pillow()
    from PIL import ImageOps
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened).convert("RGB")
    image.info.clear()
    for target, long_side, quality in ((large, LARGE_PX, LARGE_QUALITY), (thumb, THUMB_PX, THUMB_QUALITY)):
        scale = min(1.0, long_side / max(image.size))
        size = (round(image.width * scale), round(image.height * scale))
        copy = image.resize(size, Image.LANCZOS) if size != image.size else image.copy()
        copy.info.clear()
        copy.save(target, "WEBP", quality=quality, method=6)
        left = metadata_chunks(target)
        if left:
            raise ValueError(f"{target} still carries metadata: {left}")


def new_document():
    return {"schema_version": 1, "source_page": "photo_map.html", "source": SOURCE, "records": []}


def merge(records, imported, replace=False):
    """The record list with the imported ones added (or, with replace, redone with the caption and alt text already written), by time taken."""
    by_id = {record["id"]: record for record in records}
    for record in imported:
        old = by_id.get(record["id"])
        if old and not replace:
            raise ValueError(f"{record['id']} is already in data/photos.json; use --replace to write it again")
        if old:
            record = {**record, "caption": old.get("caption", ""), "alt": old.get("alt", "")}
        by_id[record["id"]] = record
    return sorted(by_id.values(), key=lambda record: (record["taken"], record["id"]))


def find_photos(folder):
    """Every DJI photo in a folder, by number."""
    found = {}
    for path in sorted(pathlib.Path(folder).iterdir()):
        if DJI_NAME.fullmatch(path.name):
            found[photo_number(path.name)] = path
    return found


def listing(path, grid):
    """One line about a photo, for choosing: number, time, where, how high, which way."""
    fields = read_xmp(path)
    number, taken = photo_number(path.name), taken_from_name(path.name).replace("T", " ")[5:16]
    try:
        x, y = grid.from_latlon(float(fields["GpsLatitude"]), float(fields["GpsLongitude"]))
        height = float(fields["RelativeAltitude"]) * M_TO_FT
        heading, pitch = heading_of(float(fields["GimbalYawDegree"])), float(fields["GimbalPitchDegree"])
    except (KeyError, ValueError):
        return f"{number:>4}  {taken}  no DJI position in the metadata"
    where = grid.cell_of(x, y) or "off the lot"
    return (f"{number:>4}  {taken}  {where:>11}  x {x:7.1f}  y {y:8.1f}  {height:5.0f} ft up  heading {heading:3d}  tilt {pitch:6.1f}"
            + ("" if near_lot(grid, x, y) else "  (not near the lot)"))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", type=pathlib.Path, help="the folder of DJI photos")
    parser.add_argument("numbers", nargs="*", type=int, help="the numbers of the photos to import")
    parser.add_argument("--list", action="store_true", help="show where each photo was taken, then stop")
    parser.add_argument("--replace", action="store_true", help="write photos that are already in data/photos.json again, keeping their captions")
    parser.add_argument("--root", type=pathlib.Path, default=ROOT, help="project root (defaults to this repository)")
    args = parser.parse_args(argv)
    photos = find_photos(args.folder)
    if not photos:
        parser.exit(1, f"No DJI photos in {args.folder}\n")
    grid = SiteGrid(args.root / "data")
    if args.list:
        for number in sorted(photos):
            print(listing(photos[number], grid))
        return 0
    if not args.numbers:
        parser.exit(1, "Say which photos to import, e.g. 3 10 65 (or use --list to see them)\n")
    missing = [number for number in args.numbers if number not in photos]
    if missing:
        parser.exit(1, f"No photo numbered {missing} in {args.folder}\n")
    data_path, images = args.root / "data" / "photos.json", args.root / "docs" / "images"
    document = json.loads(data_path.read_text(encoding="utf-8")) if data_path.exists() else new_document()
    try:
        # Every photo is read and checked before any image is written, so a bad one leaves nothing half done.
        sources = [photos[number] for number in dict.fromkeys(args.numbers)]
        imported = [camera_record(source, grid, lens_35mm(source)) for source in sources]
        document["records"] = merge(document["records"], imported, args.replace)
        images.mkdir(parents=True, exist_ok=True)
        for source, record in zip(sources, imported):
            write_copies(source, images / record["file"], images / record["thumb"])
            print(f"{record['id']}: {record['taken']}, {record['height_ft']} ft up, heading {record['heading']}, tilt {record['pitch']}")
    except ValueError as error:
        parser.exit(1, f"Import stopped: {error}\n")
    data_path.write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    blank = [record["id"] for record in document["records"] if not record["caption"].strip() or not record["alt"].strip()]
    if blank:
        print(f"Still to describe in data/photos.json (caption and alt): {', '.join(blank)}")
    print("Next: python tools/property_data.py build")
    return 0


if __name__ == "__main__":
    sys.exit(main())
