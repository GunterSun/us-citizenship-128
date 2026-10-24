import os
from PIL import Image, ImageDraw, ImageFont

icons_dir = "/Users/guntersun/.gemini/antigravity-ide/scratch/us-citizenship-128/assets/icons"
os.makedirs(icons_dir, exist_ok=True)

def create_app_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Rounded background
    radius = int(size * 0.22)
    bg_color = (15, 23, 42, 255) # Deep navy #0F172A
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=bg_color)
    
    # Golden outer border
    border_width = max(2, int(size * 0.025))
    draw.rounded_rectangle([border_width, border_width, size - border_width - 1, size - border_width - 1], 
                           radius=radius - border_width, outline=(217, 119, 6, 220), width=border_width)
    
    # Top patriotic red & white stripes subtle motif in header
    stripe_h = int(size * 0.04)
    y_start = int(size * 0.12)
    draw.rectangle([int(size * 0.2), y_start, int(size * 0.8), y_start + stripe_h], fill=(220, 38, 38, 240))
    draw.rectangle([int(size * 0.2), y_start + stripe_h, int(size * 0.8), y_start + stripe_h * 2], fill=(255, 255, 255, 240))
    draw.rectangle([int(size * 0.2), y_start + stripe_h * 2, int(size * 0.8), y_start + stripe_h * 3], fill=(37, 99, 235, 240))
    
    # Star in center-top
    star_cx = int(size * 0.5)
    star_cy = int(size * 0.36)
    r_outer = int(size * 0.10)
    r_inner = int(size * 0.042)
    import math
    star_points = []
    for i in range(10):
        r = r_outer if i % 2 == 0 else r_inner
        angle = i * math.pi / 5 - math.pi / 2
        star_points.append((star_cx + r * math.cos(angle), star_cy + r * math.sin(angle)))
    draw.polygon(star_points, fill=(245, 158, 11, 255)) # Amber #F59E0B
    
    # Text "128"
    try:
        font_large = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", int(size * 0.24))
        font_sub = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", int(size * 0.10))
    except Exception:
        font_large = ImageFont.load_default()
        font_sub = ImageFont.load_default()
        
    text_128 = "128"
    bbox_128 = draw.textbbox((0, 0), text_128, font=font_large)
    w_128 = bbox_128[2] - bbox_128[0]
    draw.text((int((size - w_128) / 2), int(size * 0.50)), text_128, fill=(255, 255, 255, 255), font=font_large)
    
    text_sub = "公民入籍"
    bbox_sub = draw.textbbox((0, 0), text_sub, font=font_sub)
    w_sub = bbox_sub[2] - bbox_sub[0]
    draw.text((int((size - w_sub) / 2), int(size * 0.76)), text_sub, fill=(217, 119, 6, 255), font=font_sub)
    
    return img

icon_512 = create_app_icon(512)
icon_512.save(os.path.join(icons_dir, "icon-512.png"))

icon_192 = create_app_icon(192)
icon_192.save(os.path.join(icons_dir, "icon-192.png"))

icon_apple = create_app_icon(180)
icon_apple.save(os.path.join(icons_dir, "apple-touch-icon.png"))

icon_fav = create_app_icon(64)
icon_fav.save(os.path.join(icons_dir, "favicon.png"))

print("Icons generated successfully!")
