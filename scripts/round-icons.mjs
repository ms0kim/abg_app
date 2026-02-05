import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '../public/icons');

async function roundIcon(inputPath, outputPath, size, radius) {
    // 둥근 모서리 마스크 생성
    const roundedMask = Buffer.from(
        `<svg width="${size}" height="${size}">
            <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
        </svg>`
    );

    await sharp(inputPath)
        .resize(size, size)
        .composite([{
            input: roundedMask,
            blend: 'dest-in'
        }])
        .png()
        .toFile(outputPath);

    console.log(`Created: ${outputPath}`);
}

async function main() {
    const cornerRadius192 = 40;  // 192px 아이콘용 (약 20%)
    const cornerRadius512 = 100; // 512px 아이콘용 (약 20%)

    try {
        await roundIcon(
            path.join(iconsDir, 'icon-192x192.png'),
            path.join(iconsDir, 'icon-192x192-rounded.png'),
            192,
            cornerRadius192
        );

        await roundIcon(
            path.join(iconsDir, 'icon-512x512.png'),
            path.join(iconsDir, 'icon-512x512-rounded.png'),
            512,
            cornerRadius512
        );

        console.log('Done! Rounded icons created.');
    } catch (err) {
        console.error('Error:', err);
    }
}

main();
