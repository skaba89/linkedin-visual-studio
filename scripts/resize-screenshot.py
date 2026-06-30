"""Resize the screenshot to a smaller size and re-save as JPEG to reduce payload for VLM."""
from PIL import Image
import os

src = "/home/z/my-project/upload/pasted_image_1782843795688.png"
dst_dir = "/home/z/my-project/scripts"
os.makedirs(dst_dir, exist_ok=True)

im = Image.open(src).convert("RGB")
print(f"Original size: {im.size}")

# Resize to width 800 keeping aspect ratio
target_w = 800
ratio = target_w / im.width
target_h = int(im.height * ratio)
im_resized = im.resize((target_w, target_h), Image.LANCZOS)
print(f"Resized to: {im_resized.size}")

dst = os.path.join(dst_dir, "screenshot_small.jpg")
im_resized.save(dst, "JPEG", quality=85, optimize=True)
print(f"Saved: {dst} ({os.path.getsize(dst)} bytes)")
