import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import tensorflow as tf


class CompatDense(tf.keras.layers.Dense):
    def __init__(self, *args, **kwargs):
        kwargs.pop('quantization_config', None)
        super().__init__(*args, **kwargs)


def load_model_with_compat(model_path: str):
    try:
        return tf.keras.models.load_model(model_path, compile=False)
    except Exception as first_error:
        try:
            return tf.keras.models.load_model(
                model_path,
                compile=False,
                custom_objects={'Dense': CompatDense},
            )
        except Exception:
            raise first_error


def normalize_category(label: str) -> str:
    normalized = ''.join(ch.lower() if ch.isalnum() else '_' for ch in label).strip('_')
    while '__' in normalized:
        normalized = normalized.replace('__', '_')
    return normalized or 'unclassified'


def load_labels(raw_labels: str, class_count: int):
    if raw_labels:
        return [label.strip() for label in raw_labels.split(',') if label.strip()]
    if class_count == 3:
        return ['garbage_heap', 'litter', 'dumping_site']
    return []


def predict(model_path: str, image_path: str, labels_csv: str):
    model = load_model_with_compat(model_path)

    input_shape = model.input_shape
    if isinstance(input_shape, list):
        input_shape = input_shape[0]

    height = input_shape[1] if len(input_shape) > 1 and input_shape[1] else 224
    width = input_shape[2] if len(input_shape) > 2 and input_shape[2] else 224

    image = Image.open(image_path).convert('RGB').resize((width, height))
    image_array = np.asarray(image).astype('float32') / 255.0
    batch = np.expand_dims(image_array, axis=0)

    prediction = model.predict(batch, verbose=0)
    prediction = np.array(prediction)

    if prediction.ndim == 2 and prediction.shape[0] == 1:
        prediction = prediction[0]

    if prediction.ndim == 0:
        prediction = np.array([float(prediction)])

    if prediction.ndim == 1 and prediction.shape[0] == 1:
        score = float(prediction[0])
        labels = ['non_garbage', 'garbage']
        index = int(score >= 0.5)
        confidence = score if index == 1 else 1.0 - score
        label = labels[index]
    else:
        scores = prediction.reshape(-1)
        index = int(np.argmax(scores))
        confidence = float(scores[index])
        labels = load_labels(labels_csv, scores.shape[0])
        label = labels[index] if index < len(labels) else 'Unclassified'

    return {
        'label': label,
        'category': normalize_category(label),
        'confidence': round(confidence, 4),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True)
    parser.add_argument('--image', required=True)
    parser.add_argument('--labels', default='')
    args = parser.parse_args()

    try:
        result = predict(args.model, args.image, args.labels)
        print(json.dumps(result))
    except Exception as error:
        print(json.dumps({'error': str(error)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
