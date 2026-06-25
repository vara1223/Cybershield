import sys
sys.path.append('.')

print("Trying to import cv2...")
try:
    import cv2
    import numpy as np
    print("cv2 imported successfully!")
except Exception as e:
    import traceback
    print("Failed to import cv2:")
    traceback.print_exc()

print("\nTrying to import pyzbar...")
try:
    from PIL import Image
    from pyzbar.pyzbar import decode as pyzbar_decode
    print("pyzbar imported successfully!")
except Exception as e:
    import traceback
    print("Failed to import pyzbar:")
    traceback.print_exc()
