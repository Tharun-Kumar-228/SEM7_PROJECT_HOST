const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const SAMPLES_DIR = path.resolve(process.cwd(), 'uploads', 'samples');
if (!fs.existsSync(SAMPLES_DIR)) {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
}

/**
 * Render array of SVG stroke paths into a solid white PNG image with anti-aliased black strokes.
 * @param {Array<string>|string} paths - SVG path strings (e.g. ["M10,20 L15,25..."])
 * @param {Object} options - { width, height, strokeWidth }
 * @returns {Promise<string>} - Absolute path to the saved PNG image.
 */
function renderPathsToPng(paths, options = {}) {
  return new Promise((resolve, reject) => {
    const width = options.width || 350;
    const height = options.height || 250;
    const strokeWidth = options.strokeWidth || 6;

    let pathsArray = paths;
    if (typeof paths === 'string') {
      try {
        pathsArray = JSON.parse(paths);
      } catch (e) {
        pathsArray = [paths];
      }
    }

    if (!Array.isArray(pathsArray) || pathsArray.length === 0) {
      return reject(new Error('Invalid paths: expected non-empty array of SVG path strings'));
    }

    const filename = `stroke-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;
    const outputPath = path.join(SAMPLES_DIR, filename);

    const pyScript = `
import re, json, sys
from PIL import Image, ImageDraw

paths = json.loads(sys.argv[1])
out_path = sys.argv[2]
width = int(sys.argv[3])
height = int(sys.argv[4])
stroke_width = int(sys.argv[5])

im = Image.new('RGB', (width, height), (255, 255, 255))
draw = ImageDraw.Draw(im)

for path_str in paths:
    tokens = re.findall(r'([ML])\\s*([0-9.]+)[,\\s]+([0-9.]+)', path_str)
    points = [(float(x), float(y)) for cmd, x, y in tokens]
    if len(points) == 1:
        x, y = points[0]
        r = stroke_width / 2
        draw.ellipse([x - r, y - r, x + r, y + r], fill=(20, 20, 20))
    elif len(points) > 1:
        draw.line(points, fill=(20, 20, 20), width=stroke_width, joint='round')

im.save(out_path, 'PNG')
print(out_path)
`;

    execFile(
      'python3',
      ['-c', pyScript, JSON.stringify(pathsArray), outputPath, String(width), String(height), String(strokeWidth)],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(stderr || error.message));
        }
        resolve(outputPath);
      }
    );
  });
}

/**
 * Resolves sample image path from either an uploaded file or stroke paths.
 * If the uploaded file is a 1x1 dummy and stroke paths are present, renders paths.
 * @param {Object} req
 * @returns {Promise<string>} Absolute or relative image path
 */
async function resolveSampleImagePath(req) {
  const hasPaths = req.body && req.body.paths && (typeof req.body.paths === 'string' || Array.isArray(req.body.paths));

  // Check if req.file is a 1x1 dummy
  let isDummyFile = false;
  if (req.file && fs.existsSync(req.file.path)) {
    const stats = fs.statSync(req.file.path);
    if (stats.size < 200) {
      isDummyFile = true;
    }
  }

  if (hasPaths && (isDummyFile || !req.file)) {
    try {
      const renderedPath = await renderPathsToPng(req.body.paths);
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {}
      }
      return renderedPath;
    } catch (err) {
      console.warn('[StrokeRenderer] Falling back to file due to rasterization error:', err.message);
    }
  }

  if (req.file) {
    return req.file.path;
  }

  if (req.body.imagePath && fs.existsSync(req.body.imagePath)) {
    return req.body.imagePath;
  }

  if (req.body.imageBase64) {
    const b64 = req.body.imageBase64.includes(',')
      ? req.body.imageBase64.split(',')[1]
      : req.body.imageBase64;
    const filename = `b64-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;
    const tempPath = path.join(SAMPLES_DIR, filename);
    fs.writeFileSync(tempPath, Buffer.from(b64, 'base64'));
    return tempPath;
  }

  return null;
}

module.exports = {
  renderPathsToPng,
  resolveSampleImagePath,
};
