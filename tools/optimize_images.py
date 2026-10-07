"""Generate responsive derivatives without changing uploaded originals."""
from pathlib import Path
import json
import re
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent
out = root / 'media'
out.mkdir(exist_ok=True)
manifest = {}
sources = set()
for filename in ['index.html', 'js/index.js']:
    sources.update(re.findall(r'src="([^"${]+\.(?:png|jpeg|jpg))"', (root / filename).read_text(encoding='utf-8')))
for index, name in enumerate(sorted(sources)):
    file = root / name
    if not file.is_file():
        continue
    with Image.open(file) as source:
        image = ImageOps.exif_transpose(source)
        width, height = image.size
        variants = []
        for size in [320, 640, 960]:
            if size > width:
                continue
            target = out / f'product-{index}-{size}.webp'
            preview = image.copy()
            preview.thumbnail((size, round(size * height / width)), Image.Resampling.LANCZOS)
            preview.save(target, 'WEBP', quality=86, method=6)
            if target.stat().st_size >= file.stat().st_size:
                target.unlink()
            else:
                variants.append(f'media/{target.name} {preview.width}w')
        manifest[name] = {'width': width, 'height': height, 'srcset': ', '.join(variants)}
for filename in ['index.html', 'js/index.js']:
    text = (root / filename).read_text(encoding='utf-8')
    for name, metadata in manifest.items():
        attrs = f' width="{metadata["width"]}" height="{metadata["height"]}"'
        if metadata['srcset']:
            attrs += f' srcset="{metadata["srcset"]}" sizes="(max-width: 639px) 90vw, (max-width: 1023px) 45vw, 32rem"'
        pattern = r'<img src="' + re.escape(name) + r'"[^>]*>'
        def responsive_tag(match):
            tag = re.sub(r'\s(?:width|height|srcset|sizes)="[^"]*"', '', match.group())
            return tag.replace(f'<img src="{name}"', f'<img src="{name}"{attrs}')
        text = re.sub(pattern, responsive_tag, text)
    (root / filename).write_text(text, encoding='utf-8')
print(json.dumps(manifest, indent=2, ensure_ascii=False))
