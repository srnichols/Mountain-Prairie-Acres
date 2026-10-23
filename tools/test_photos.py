"""The photo list, the web copies of the photos, and the importer that makes them."""
import contextlib
import io
import json
import pathlib
import shutil
import struct
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import import_photos as importer  # noqa: E402
from property_data import MAX_OFF_LOT_FT, load_data  # noqa: E402
from site_grid import SiteGrid  # noqa: E402

try:
    from PIL import Image
except ImportError:  # Pillow is only needed to write the image copies, so CI runs without it
    Image = None

ROOT = pathlib.Path(__file__).resolve().parents[1]
IMAGES = ROOT / "docs" / "images"
needs_pillow = unittest.skipUnless(Image, "Pillow is not installed")


def xmp_packet(**values):
    attributes = " ".join(f'drone-dji:{key}="{value}"' for key, value in values.items())
    return f'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description {attributes}/></rdf:RDF></x:xmpmeta>'.encode()


def dji_values(grid, x, y, height_m=8.0, yaw=-148.3, pitch=-6.8):
    latitude, longitude = grid.to_latlon(x, y)
    return dict(GpsLatitude=latitude, GpsLongitude=longitude, RelativeAltitude=height_m, GimbalYawDegree=yaw, GimbalPitchDegree=pitch)


def fake_jpeg(path, **values):
    """A file that starts like a JPEG and carries a DJI packet: enough for the position and angles, not for an image library."""
    path.write_bytes(b"\xff\xd8" + xmp_packet(**values) + b"\xff\xd9")


def riff(*chunks):
    body = b"WEBP" + b"".join(name + struct.pack("<I", len(data)) + data + (b"\0" if len(data) % 2 else b"") for name, data in chunks)
    return b"RIFF" + struct.pack("<I", len(body)) + body


class PhotoFilesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.records = load_data(ROOT)["photos"]["records"]

    def test_the_list_has_photos(self):
        self.assertGreaterEqual(len(self.records), 10)

    def test_every_photo_has_a_clean_web_sized_large_and_small_webp_file(self):
        for record in self.records:
            sizes = {}
            for key, longest, heaviest in (("file", importer.LARGE_PX, 900_000), ("thumb", importer.THUMB_PX, 60_000)):
                path = IMAGES / record[key]
                with self.subTest(photo=record["id"], file=record[key]):
                    self.assertTrue(path.is_file(), f"{path} is missing")
                    self.assertEqual(importer.metadata_chunks(path), [], "A web copy must carry no EXIF, XMP, or color profile (the drone's GPS and serial number)")
                    self.assertLess(path.stat().st_size, heaviest, "Keep it web-sized")
                    width, height = importer.webp_size(path)
                    self.assertLessEqual(max(width, height), longest)
                    self.assertIn(round(width / height, 2), (1.33, 0.75), "A drone photo is 4:3")
                    sizes[key] = width / height
            if len(sizes) == 2:
                self.assertAlmostEqual(sizes["file"], sizes["thumb"], delta=0.02, msg=f"{record['id']}: the thumbnail is a different shape from the photo")

    def test_docs_images_holds_the_listed_photos_and_nothing_else(self):
        listed = {record[key] for record in self.records for key in ("file", "thumb")}
        present = {path.name for path in IMAGES.iterdir()}
        self.assertEqual(sorted(present - listed), [], "These files in docs/images/ belong to no photo in data/photos.json")
        self.assertEqual(sorted(listed - present), [])

    def test_each_record_agrees_with_the_name_of_the_original_it_came_from(self):
        for record in self.records:
            with self.subTest(photo=record["id"]):
                self.assertEqual(record["id"], f"dji_{importer.photo_number(record['original']):04d}")
                self.assertEqual(record["taken"], importer.taken_from_name(record["original"]))

    def test_the_importer_and_the_checker_allow_the_same_distance_from_the_lot(self):
        self.assertEqual(importer.MAX_OFF_LOT_FT, MAX_OFF_LOT_FT)


class ImporterTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.grid = SiteGrid()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = pathlib.Path(self.temp.name)

    def test_the_number_and_time_come_from_the_dji_file_name(self):
        self.assertEqual(importer.photo_number("DJI_20261019175220_0065_D.JPG"), 65)
        self.assertEqual(importer.photo_number("C:/photos/dji_20261019175220_0065_d.jpg"), 65, "the folder and the letter case do not matter")
        self.assertEqual(importer.taken_from_name("DJI_20261019175220_0065_D.JPG"), "2026-10-19T17:52:20")
        for name in ("IMG_0065.JPG", "DJI_20261019175220_0065_D.MP4", "DJI_2026_0065_D.JPG"):
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, "not a DJI photo name"):
                importer.photo_number(name)
        with self.assertRaisesRegex(ValueError, "not a DJI photo name"):
            importer.taken_from_name("IMG_0065.JPG")

    def test_the_xmp_packet_gives_attributes_and_elements_and_nothing_when_missing(self):
        packet = b"junk" + xmp_packet(GpsLatitude="43.4", GimbalYawDegree="-148.3") + b"trailing junk"
        self.assertEqual(importer.xmp_fields(packet), {"GpsLatitude": "43.4", "GimbalYawDegree": "-148.3"})
        self.assertEqual(importer.xmp_fields(b"no packet here"), {})
        self.assertEqual(importer.xmp_fields(b"<x:xmpmeta never closed"), {})
        element = b"<x:xmpmeta><drone-dji:RelativeAltitude>+8.20</drone-dji:RelativeAltitude></x:xmpmeta>"
        self.assertEqual(importer.xmp_fields(element), {"RelativeAltitude": "+8.20"})

    def test_the_field_of_view_follows_the_35_mm_equivalent_lens_of_a_4_by_3_photo(self):
        self.assertEqual(importer.field_of_view(24), 71.6)
        self.assertEqual(importer.field_of_view(70), 27.8)
        for bad in (None, 0, -24):
            with self.subTest(focal=bad), self.assertRaisesRegex(ValueError, "no 35 mm focal length"):
                importer.field_of_view(bad)

    def test_a_heading_is_a_compass_bearing_from_0_to_359(self):
        for yaw, expected in ((-148.3, 212), (164.9, 165), (0, 0), (-0.4, 0), (359.6, 0), (-180, 180), (180, 180), (90, 90), (-90, 270), (-1, 359)):
            with self.subTest(yaw=yaw):
                self.assertEqual(importer.heading_of(yaw), expected)

    def test_a_camera_record_places_the_photo_on_the_grid_and_leaves_the_words_to_a_person(self):
        name = "DJI_20261019175220_0065_D.JPG"
        fake_jpeg(self.folder / name, **dji_values(self.grid, 150.0, 820.0, height_m=8.0, yaw=-148.3, pitch=-6.8))
        record = importer.camera_record(self.folder / name, self.grid, 70)
        self.assertEqual(record, {
            "id": "dji_0065", "file": "dji_0065.webp", "thumb": "dji_0065_t.webp", "original": name, "taken": "2026-10-19T17:52:20",
            "x": 150.0, "y": 820.0, "height_ft": 26, "heading": 212, "pitch": -7, "fov": 27.8, "caption": "", "alt": ""})

    def test_a_shot_with_no_position_or_taken_far_away_is_refused(self):
        name = "DJI_20261019175220_0065_D.JPG"
        (self.folder / name).write_bytes(b"\xff\xd8\xff\xd9")
        with self.assertRaisesRegex(ValueError, "no DJI position"):
            importer.camera_record(self.folder / name, self.grid, 24)
        far = dict(dji_values(self.grid, 150.0, 820.0), GpsLatitude=44.5)
        fake_jpeg(self.folder / name, **far)
        with self.assertRaisesRegex(ValueError, "not taken near the lot"):
            importer.camera_record(self.folder / name, self.grid, 24)
        indoors = dict(dji_values(self.grid, 150.0, 820.0), GpsLatitude="x")
        fake_jpeg(self.folder / name, **indoors)
        with self.assertRaisesRegex(ValueError, "no DJI position"):
            importer.camera_record(self.folder / name, self.grid, 24)
        # A camera just inside the allowed distance from the fence is kept.
        inside = dji_values(self.grid, 150.0, self.grid.data["lot"]["fence"]["depth"] + MAX_OFF_LOT_FT - 1)
        fake_jpeg(self.folder / name, **inside)
        self.assertGreater(importer.camera_record(self.folder / name, self.grid, 24)["y"], 1800)

    def test_a_camera_may_be_just_below_the_take_off_point_and_the_tilt_is_kept_in_range(self):
        name = "DJI_20261019175220_0065_D.JPG"
        fake_jpeg(self.folder / name, **dji_values(self.grid, 150.0, 820.0, height_m=-3.0, pitch=-93.0))
        record = importer.camera_record(self.folder / name, self.grid, 24)
        self.assertEqual((record["height_ft"], record["pitch"]), (0, -90))

    def test_merging_adds_sorts_by_time_and_keeps_written_captions_when_a_photo_is_redone(self):
        def record(number, taken, caption="", alt=""):
            return {"id": f"dji_{number:04d}", "taken": taken, "x": 1.0, "caption": caption, "alt": alt}
        existing = [record(10, "2026-10-19T17:52:00", "Ten", "Alt ten"), record(3, "2026-09-27T15:36:00", "Three", "Alt three")]
        merged = importer.merge(existing, [record(5, "2026-10-10T13:00:00")])
        self.assertEqual([r["id"] for r in merged], ["dji_0003", "dji_0005", "dji_0010"])
        with self.assertRaisesRegex(ValueError, "dji_0010 is already in data/photos.json; use --replace"):
            importer.merge(existing, [record(10, "2026-10-19T17:52:00")])
        redone = importer.merge(existing, [dict(record(10, "2026-10-19T17:52:30"), x=2.0)], replace=True)
        self.assertEqual([(r["id"], r["taken"], r["x"], r["caption"], r["alt"]) for r in redone],
                         [("dji_0003", "2026-09-27T15:36:00", 1.0, "Three", "Alt three"), ("dji_0010", "2026-10-19T17:52:30", 2.0, "Ten", "Alt ten")])
        self.assertEqual(existing[0]["x"], 1.0, "merging does not change the list it was given")

    def test_the_webp_reader_finds_the_size_and_any_metadata_without_an_image_library(self):
        vp8x = b"\0\0\0\0" + (1599).to_bytes(3, "little") + (1199).to_bytes(3, "little")
        vp8l = b"\x2f" + struct.pack("<I", 399 | (299 << 14))
        vp8 = b"\0\0\0" + b"\x9d\x01\x2a" + struct.pack("<HH", 400, 300)
        cases = [("extended", riff((b"VP8X", vp8x), (b"VP8 ", vp8)), (1600, 1200), []),
                 ("lossless", riff((b"VP8L", vp8l)), (400, 300), []),
                 ("lossy", riff((b"VP8 ", vp8)), (400, 300), []),
                 ("with metadata", riff((b"VP8X", vp8x), (b"ICCP", b"profile"), (b"VP8 ", vp8), (b"EXIF", b"odd"), (b"XMP ", b"packet")), (1600, 1200), ["ICCP", "EXIF", "XMP "])]
        for label, content, size, metadata in cases:
            path = self.folder / f"{label.replace(' ', '_')}.webp"
            path.write_bytes(content)
            with self.subTest(case=label):
                self.assertEqual(importer.webp_size(path), size)
                self.assertEqual(importer.metadata_chunks(path), metadata)
        for label, content in (("a JPEG", b"\xff\xd8\xff\xe0"), ("empty", b""), ("a short file", b"RIFF")):
            path = self.folder / "bad.webp"
            path.write_bytes(content)
            with self.subTest(case=label), self.assertRaisesRegex(ValueError, "not a WebP file"):
                importer.webp_size(path)
        path = self.folder / "headerless.webp"
        path.write_bytes(riff((b"JUNK", b"data")))
        with self.assertRaisesRegex(ValueError, "no image header"):
            importer.webp_size(path)

    def make_photo(self, name, folder=None, size=(3200, 2400), orientation=None, **values):
        """A real JPEG with the drone's metadata: EXIF with a make, an orientation, and a 35 mm focal length, plus the DJI XMP packet."""
        image = Image.new("RGB", size, (120, 160, 90))
        exif = Image.Exif()
        exif[0x010F] = "DJI"
        exif.get_ifd(0x8769)[0xA405] = 24
        if orientation:
            exif[0x0112] = orientation
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", exif=exif)
        data = buffer.getvalue()
        header = b"http://ns.adobe.com/xap/1.0/\x00"
        packet = xmp_packet(**values)
        path = (folder or self.folder) / name
        path.write_bytes(data[:2] + b"\xff\xe1" + struct.pack(">H", len(header) + len(packet) + 2) + header + packet + data[2:])
        return path

    @needs_pillow
    def test_the_web_copies_are_resized_and_carry_no_metadata(self):
        source = self.make_photo("DJI_20261019175220_0065_D.JPG", **dji_values(self.grid, 150.0, 820.0))
        self.assertEqual(importer.lens_35mm(source), 24)
        large, thumb = self.folder / "large.webp", self.folder / "thumb.webp"
        importer.write_copies(source, large, thumb)
        self.assertEqual(importer.webp_size(large), (1600, 1200))
        self.assertEqual(importer.webp_size(thumb), (400, 300))
        for path in (large, thumb):
            self.assertEqual(importer.metadata_chunks(path), [])
            with Image.open(path) as image:
                self.assertEqual(dict(image.getexif()), {})
                self.assertNotIn(b"drone-dji", path.read_bytes())

    @needs_pillow
    def test_the_exif_orientation_is_applied_and_a_small_photo_is_not_enlarged(self):
        turned = self.make_photo("turned.JPG", size=(2400, 3200), orientation=6)
        large, thumb = self.folder / "turned_large.webp", self.folder / "turned_thumb.webp"
        importer.write_copies(turned, large, thumb)
        self.assertEqual(importer.webp_size(large), (1600, 1200), "rotated upright it is 3200 x 2400, so it fits the long side")
        small = self.make_photo("small.JPG", size=(800, 600))
        importer.write_copies(small, large, thumb)
        self.assertEqual(importer.webp_size(large), (800, 600))
        self.assertEqual(importer.webp_size(thumb), (400, 300))

    @needs_pillow
    def test_the_command_lists_imports_refuses_repeats_and_keeps_captions_on_replace(self):
        root = self.folder / "project"
        (root / "data").mkdir(parents=True)
        shutil.copy(ROOT / "data" / "site.json", root / "data" / "site.json")
        photos = self.folder / "photos"
        photos.mkdir()
        self.make_photo("DJI_20261019175220_0065_D.JPG", photos, **dji_values(self.grid, 155.0, 820.0))
        self.make_photo("DJI_20261010131204_0024_D.JPG", photos, **dji_values(self.grid, 139.0, 837.0, height_m=76.0, yaw=-17.3, pitch=-90.0))
        (photos / "DJI_20261019175221_0066_D.MP4").write_bytes(b"not a photo")

        def run(*argv):
            out = io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
                try:
                    code = importer.main([str(photos), *argv, "--root", str(root)])
                except SystemExit as stop:
                    code = stop.code
            return code, out.getvalue()

        code, text = run("--list")
        self.assertEqual(code, 0)
        self.assertEqual(len(text.splitlines()), 2, "only the photos are listed")
        self.assertRegex(text, r"(?m)^\s+24\s+10-10 13:12\s+C17\s")
        self.assertRegex(text, r"(?m)^\s+65\s+10-19 17:52\s+D17\s")
        self.assertFalse((root / "data" / "photos.json").exists(), "listing writes nothing")
        self.assertEqual(run()[0], 1, "with no numbers there is nothing to do")
        self.assertEqual(run("99")[0], 1)
        code, text = run("65", "24", "65")
        self.assertEqual(code, 0, text)
        self.assertIn("Still to describe in data/photos.json (caption and alt): dji_0024, dji_0065", text)
        self.assertIn("python tools/property_data.py build", text)
        document = json.loads((root / "data" / "photos.json").read_text(encoding="utf-8"))
        self.assertEqual((document["schema_version"], document["source_page"]), (1, "photo_map.html"))
        self.assertEqual([r["id"] for r in document["records"]], ["dji_0024", "dji_0065"], "sorted by the time taken")
        for record in document["records"]:
            self.assertTrue((root / "docs" / "images" / record["file"]).is_file())
            self.assertTrue((root / "docs" / "images" / record["thumb"]).is_file())
        before = {p.name: p.stat().st_mtime_ns for p in (root / "docs" / "images").iterdir()}
        code, text = run("65")
        self.assertEqual(code, 1)
        self.assertIn("already in data/photos.json", text)
        self.assertEqual({p.name: p.stat().st_mtime_ns for p in (root / "docs" / "images").iterdir()}, before, "a refused import writes no image")
        document["records"][1].update(caption="Written by hand", alt="Alt by hand")
        (root / "data" / "photos.json").write_text(json.dumps(document), encoding="utf-8")
        code, text = run("65", "--replace")
        self.assertEqual(code, 0, text)
        again = json.loads((root / "data" / "photos.json").read_text(encoding="utf-8"))
        self.assertEqual([(r["id"], r["caption"], r["alt"]) for r in again["records"]],
                         [("dji_0024", "", ""), ("dji_0065", "Written by hand", "Alt by hand")])


if __name__ == "__main__":
    unittest.main()
