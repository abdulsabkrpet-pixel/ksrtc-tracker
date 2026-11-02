import zlib
import struct
import os

def create_png(width, height, color_rgb):
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
    png += struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # IDAT chunk (raw RGB image with filter byte 0 per scanline)
    raw_data = bytearray()
    r, g, b = color_rgb
    for y in range(height):
        raw_data.append(0) # Filter type 0: None
        for x in range(width):
            # Draw a gold border and red center
            if x < 10 or x >= width - 10 or y < 10 or y >= height - 10:
                raw_data.extend([245, 158, 11]) # Gold border
            else:
                raw_data.extend([r, g, b]) # KSRTC Crimson Red
                
    compressed = zlib.compress(bytes(raw_data))
    idat_crc = zlib.crc32(b'IDAT' + compressed)
    png += struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND')
    png += struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    return png

os.makedirs('/data/data/com.termux/files/home/ksrtc-tracker/public/icons', exist_ok=True)

with open('/data/data/com.termux/files/home/ksrtc-tracker/public/icons/icon-192.png', 'wb') as f:
    f.write(create_png(192, 192, (192, 38, 45)))

with open('/data/data/com.termux/files/home/ksrtc-tracker/public/icons/icon-512.png', 'wb') as f:
    f.write(create_png(512, 512, (192, 38, 45)))

print("PWA Icons generated successfully!")
