import json
import numpy as np
import onnxruntime as ort

with open("metadata.json", "r", encoding="utf-8") as f:
    meta = json.load(f)

sess = ort.InferenceSession("recommender.onnx", providers=["CPUExecutionProvider"])

user_id = 1
movie_id = 1

user_idx = np.array([meta["user2idx"][str(user_id)]], dtype=np.int64)
movie_idx = np.array([meta["movie2idx"][str(movie_id)]], dtype=np.int64)

pred = sess.run(None, {"user_idx": user_idx, "movie_idx": movie_idx})[0]
print("Predicted rating:", float(pred[0]))
