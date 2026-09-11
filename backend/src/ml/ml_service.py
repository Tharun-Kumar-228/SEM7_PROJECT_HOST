import os
import sys
import tempfile
import base64
from flask import Flask, request, jsonify
from predict_character import predict_single_character, load_model as load_character_model
from predict_sentence import predict_single_sentence, load_sentence_model

app = Flask(__name__)

# Preload both models at startup
try:
    load_character_model()
    print("[ML SERVICE] VisionMamba Dyslexia character model pre-loaded.")
except Exception as e:
    print(f"[ML SERVICE WARNING] Character model preload failed: {e}")

try:
    load_sentence_model()
    print("[ML SERVICE] VMamba2D Dysgraphia sentence model pre-loaded.")
except Exception as e:
    print(f"[ML SERVICE WARNING] Sentence model preload failed: {e}")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'HEALTHY',
        'service': 'neuroscreen-ml-dual-model-service',
        'models': {
            'character': 'VisionMamba-SingleCharacter-V1 (Dyslexia)',
            'sentence': 'VMamba2D-Sentence-V1 (Dysgraphia)'
        }
    })

@app.route('/predict/character', methods=['POST'])
def predict_character():
    try:
        image_path = None
        temp_file = None
        expected_char = None
        char_type = 'LETTER'

        if 'image' in request.files:
            file = request.files['image']
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            file.save(temp_file.name)
            image_path = temp_file.name
            expected_char = request.form.get('expected_character') or request.form.get('expectedCharacter')
            char_type = request.form.get('character_type') or request.form.get('characterType') or 'LETTER'
        elif request.is_json:
            data = request.get_json()
            expected_char = data.get('expected_character') or data.get('expectedCharacter')
            char_type = data.get('character_type') or data.get('characterType') or 'LETTER'
            if 'image_path' in data and os.path.exists(data['image_path']):
                image_path = data['image_path']
            elif 'image_base64' in data:
                b64_data = data['image_base64']
                if ',' in b64_data:
                    b64_data = b64_data.split(',')[1]
                img_bytes = base64.b64decode(b64_data)
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
                temp_file.write(img_bytes)
                temp_file.close()
                image_path = temp_file.name

        if not image_path:
            return jsonify({'success': False, 'error': 'No image file or image_path/image_base64 provided'}), 400

        result = predict_single_character(image_path, expected_character=expected_char, character_type=char_type)

        if temp_file and os.path.exists(temp_file.name):
            try:
                os.remove(temp_file.name)
            except Exception:
                pass

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/predict/sentence', methods=['POST'])
def predict_sentence():
    try:
        image_path = None
        temp_file = None
        expected_sentence = None

        if 'image' in request.files:
            file = request.files['image']
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            file.save(temp_file.name)
            image_path = temp_file.name
            expected_sentence = request.form.get('expected_sentence') or request.form.get('expectedSentence')
        elif request.is_json:
            data = request.get_json()
            expected_sentence = data.get('expected_sentence') or data.get('expectedSentence')
            if 'image_path' in data and os.path.exists(data['image_path']):
                image_path = data['image_path']
            elif 'image_base64' in data:
                b64_data = data['image_base64']
                if ',' in b64_data:
                    b64_data = b64_data.split(',')[1]
                img_bytes = base64.b64decode(b64_data)
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
                temp_file.write(img_bytes)
                temp_file.close()
                image_path = temp_file.name

        if not image_path:
            return jsonify({'success': False, 'error': 'No image file or image_path/image_base64 provided'}), 400

        result = predict_single_sentence(image_path, expected_sentence=expected_sentence)

        if temp_file and os.path.exists(temp_file.name):
            try:
                os.remove(temp_file.name)
            except Exception:
                pass

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

        if temp_file and os.path.exists(temp_file.name):
            try:
                os.remove(temp_file.name)
            except Exception:
                pass

        return jsonify(result), 200

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('ML_PORT', 5001))
    print(f"[ML SERVICE] Starting Dual-Model VisionMamba HTTP Server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
