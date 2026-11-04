import base64, re

with open('findcollege_landing_page.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Check logo
m = re.search(r'class="brand"[^>]*>.*?src="data:image/([^;]+);base64,([^"]+)"', text, re.DOTALL)
if m:
    mime, b64 = m.groups()
    try:
        data = base64.b64decode(b64)
        with open('logo_test.png', 'wb') as lf:
            lf.write(data)
        print('Logo decoded successfully, length:', len(data))
    except Exception as e:
        print('Logo decode error:', e)
else:
    print('Logo not found')

# Check course art cards
cards = re.findall(r'<div class="course-art">.*?src="data:image/([^;]+);base64,([^"]+)"', text, re.DOTALL)
print('Found course-art images:', len(cards))
for i, (mime, b64) in enumerate(cards):
    try:
        data = base64.b64decode(b64)
        with open(f'card_{i+1}.jpg', 'wb') as cf:
            cf.write(data)
        print(f'Card {i+1} decoded, length:', len(data))
    except Exception as e:
        print(f'Card {i+1} decode error:', e)

