import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from google import genai

DEFAULT_MODEL = "gemini-2.5-flash"
DEFAULT_API_KEY = "AIzaSyC_p4VCH7Ck56j0JlGomSXFgwvUPlm4FhE"


def build_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY", DEFAULT_API_KEY)
    return genai.Client(api_key=api_key)


client = build_client()
app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)


@app.route("/")
def index():
    return send_from_directory(app.template_folder, "index.html")


def generate_response(prompt: str, model: str = DEFAULT_MODEL) -> str:
    response = client.generate_content(model=model, contents=prompt)
    return response.text


def handle_generation(prompt_builder):
    try:
        prompt = prompt_builder()
        text = generate_response(prompt)
        return jsonify({"text": text})
    except Exception as exc:  # pragma: no cover - defensive programming
        return jsonify({"error": str(exc)}), 500


@app.post("/api/math-question")
def api_math_question():
    data = request.get_json(force=True)
    question = data.get("question", "").strip()
    if not question:
        return jsonify({"error": "질문을 입력해주세요."}), 400
    return handle_generation(lambda: f"다음 수학 질문에 대해 한국어로 초보자도 이해하기 쉽게 설명해줘: \"{question}\"")


@app.post("/api/story")
def api_story():
    data = request.get_json(force=True)
    words = data.get("words", [])
    if not isinstance(words, list) or len(words) < 3:
        return jsonify({"error": "단어가 최소 3개 이상 필요합니다."}), 400
    word_list = ", ".join(words)
    return handle_generation(lambda: (
        "다음 영어 단어들을 모두 사용해서 3-4문장으로 된 짧고 재미있는 영어 스토리를 만들고, "
        f"한국어 번역도 함께 제공해줘: {word_list}"
    ))


@app.post("/api/grammar")
def api_grammar():
    data = request.get_json(force=True)
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "교정할 문장을 입력해주세요."}), 400
    return handle_generation(
        lambda: (
            "다음 영어 문장의 문법 오류를 교정하고, 어떤 부분이 왜 틀렸는지 간단히 설명해줘: "
            f"\"{text}\""
        )
    )


@app.post("/api/summary")
def api_summary():
    data = request.get_json(force=True)
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "요약할 텍스트를 입력해주세요."}), 400
    return handle_generation(lambda: f"다음 텍스트를 한국어로 2-3문장으로 요약해줘: \"{text}\"")


@app.post("/api/quiz-problem")
def api_quiz_problem():
    data = request.get_json(force=True)
    topic = data.get("topic", "").strip()
    difficulty = data.get("difficulty", "").strip() or "초급"
    if not topic:
        return jsonify({"error": "문제 생성 주제를 입력해주세요."}), 400
    return handle_generation(lambda: f"{topic}에 대한 {difficulty} 난이도의 수학 문제를 1개 만들어주고, 정답과 간단한 풀이도 함께 제공해줘.")


@app.post("/api/proof")
def api_proof():
    data = request.get_json(force=True)
    formula = data.get("formula", "").strip()
    if not formula:
        return jsonify({"error": "증명할 공식을 입력해주세요."}), 400
    return handle_generation(lambda: f"{formula}에 대한 수학적 증명 과정을 단계별로 알기 쉽게 설명해줘.")


@app.post("/api/analogy")
def api_analogy():
    data = request.get_json(force=True)
    concept = data.get("concept", "").strip()
    if not concept:
        return jsonify({"error": "설명할 개념을 입력해주세요."}), 400
    return handle_generation(lambda: f"\"{concept}\"라는 개념을 초등학생도 이해할 수 있도록 일상생활의 재미있는 비유를 들어 설명해줘.")


@app.post("/api/dialog")
def api_dialog():
    data = request.get_json(force=True)
    topic = data.get("topic", "").strip()
    if not topic:
        return jsonify({"error": "대화 주제를 입력해주세요."}), 400
    return handle_generation(lambda: (
        "너는 친절한 영어 회화 선생님이야. 지금부터 "
        f"{topic}에 대한 주제로 영어 프리토킹을 시작하자. 먼저 나에게 간단한 질문을 하면서 대화를 시작해줘."
    ))


@app.post("/api/wrong-problem")
def api_wrong_problem():
    data = request.get_json(force=True)
    problem = data.get("problem", "").strip()
    if not problem:
        return jsonify({"error": "틀린 문제와 풀이를 입력해주세요."}), 400
    return handle_generation(lambda: (
        "내가 수학 문제를 풀다가 틀렸어. 아래는 내가 푼 문제와 나의 풀이야. 왜 틀렸는지, 올바른 풀이 방법은 무엇인지 설명해주고, "
        f"비슷한 유형의 추가 문제도 1개 만들어줘.\n\n[문제와 풀이]\n{problem}"
    ))


@app.post("/api/word-game")
def api_word_game():
    data = request.get_json(force=True)
    words = data.get("words", [])
    if not isinstance(words, list) or len(words) < 5:
        return jsonify({"error": "단어가 최소 5개 이상 필요합니다."}), 400
    word_list = ", ".join(words)
    return handle_generation(lambda: (
        "나의 영어 단어장에는 이런 단어들이 있어: "
        f"{word_list}. 이 단어들을 활용해서 혼자서 또는 친구와 함께 할 수 있는 재미있는 단어 암기 게임 아이디어 2가지를 제안해줘."
    ))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
