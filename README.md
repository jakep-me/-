# 개인 맞춤형 영어 & 수학 학습 웹사이트

이 프로젝트는 플래시카드 기반의 영어 단어장과 Gemini API를 활용한 수학/영어 학습 보조 도구를 제공합니다. 모든 AI 기능은 백엔드에서 [google-genai](https://pypi.org/project/google-genai/) SDK를 통해 호출되며, 환경 변수에 `GEMINI_API_KEY`가 설정되어 있지 않은 경우 기본 키(`AIzaSyC_p4VCH7Ck56j0JlGomSXFgwvUPlm4FhE`)를 사용합니다.

## 주요 기능

- **영어 단어 관리**: 단어 추가/삭제, 난이도 필터링, 플래시카드 학습
- **수학 질문 응답**: AI에게 수학 질문을 하고 답변을 저장
- **10가지 학습 보조 도구**: 스토리 생성, 문법 교정, 요약, 문제 생성, 증명, 비유 설명, 영어 대화, 오답노트 분석, 단어 게임 제안 등
- **학습 통계**: 단어 수, 학습 단어 수, 수학 질문 수 등을 로컬에서 집계

## 로컬 실행 방법

1. **의존성 설치**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **환경 변수 설정 (선택 사항)**
   ```bash
   export GEMINI_API_KEY="your_api_key"  # Windows: set GEMINI_API_KEY="your_api_key"
   ```

3. **서버 실행**
   ```bash
   flask --app app run --host 0.0.0.0 --port 5000 --debug
   ```

4. **웹페이지 접속**
   브라우저에서 `http://localhost:5000`으로 접속하면 웹 애플리케이션을 사용할 수 있습니다.

## 주의사항

- Gemini API 사용 시 요금 및 할당량 정책을 확인하세요.
- 로컬 스토리지를 활용하므로 브라우저를 변경하거나 초기화하면 저장된 단어/질문 데이터가 사라질 수 있습니다.
- 프로덕션 환경에서는 기본 API 키 대신 안전하게 관리되는 키를 사용하세요.
