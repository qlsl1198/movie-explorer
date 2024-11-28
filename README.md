# Movie Explorer 🎬

영화 탐색 및 정보 제공 웹 애플리케이션입니다. TMDB API를 활용하여 최신 영화 정보를 제공하며, 다양한 필터링 옵션으로 원하는 영화를 쉽게 찾을 수 있습니다.

## 주요 기능 ✨

### 영화 필터링
- 개봉 상태별 필터링 (개봉예정작/개봉작)
- 장르별 다중 선택 필터링
- 국가별 필터링 (한국, 미국, 일본 등)
- 정렬 옵션 (최신순, 평점순, 인기순)

### 영화 상세 정보
- 기본 정보 (제목, 개봉일, 평점, 러닝타임)
- 상세 줄거리
- 주요 출연진 정보 (프로필 사진, 배역)
- 감독 정보

### 사용자 인터페이스
- 반응형 디자인 (모바일, 태블릿, 데스크톱)
- 직관적인 필터 UI
- 모달 기반 상세 정보 표시
- 그리드 레이아웃의 영화 목록

## 기술 스택 🛠

### Frontend
- HTML5
- CSS3 (반응형 디자인)
- Vanilla JavaScript (ES6+)

### Backend
- Node.js
- Express.js
- TMDB API

## 설치 및 실행 방법 🚀

1. 저장소 클론
\`\`\`bash
git clone https://github.com/qlsl1198/movie-explorer.git
cd movie-explorer
\`\`\`

2. 의존성 설치
\`\`\`bash
npm install
\`\`\`

3. 환경 변수 설정
- \`.env\` 파일 생성 후 TMDB API 키 설정
\`\`\`
TMDB_API_KEY=your_api_key_here
\`\`\`

4. 서버 실행
\`\`\`bash
npm start
\`\`\`

5. 브라우저에서 접속
- http://localhost:3000 으로 접속

## API 키 발급 방법 🔑

1. [TMDB 웹사이트](https://www.themoviedb.org/) 접속
2. 회원가입 및 로그인
3. 설정 → API → 새 API 키 발급
4. 발급받은 키를 \`.env\` 파일에 설정

## 주요 기능 상세 📝

### 영화 필터링
- 개봉예정작: 현재 날짜 이후 개봉 예정인 영화
- 개봉작: 최근 3개월 내 개봉한 영화
- 장르: 19개 장르 중 다중 선택 가능
- 국가: 15개 주요 국가 선택 가능

### 정렬 옵션
- 최신순: 개봉일 기준 정렬
- 평점순: 관객 평점 기준 정렬
- 인기순: TMDB 인기도 기준 정렬

### 상세 정보
- 포스터 이미지
- 기본 정보 (제목, 개봉일, 평점)
- 상세 줄거리
- 주요 출연진 최대 5명
- 감독 정보

## 브라우저 지원 🌐

- Chrome (최신 버전)
- Firefox (최신 버전)
- Safari (최신 버전)
- Edge (최신 버전)

## 라이선스 📄

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 기여 방법 💡

1. Fork the Project
2. Create your Feature Branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit your Changes (\`git commit -m 'Add some AmazingFeature'\`)
4. Push to the Branch (\`git push origin feature/AmazingFeature\`)
5. Open a Pull Request

## 문의사항 💌

프로젝트에 대한 문의사항이나 버그 리포트는 GitHub Issues를 통해 제출해 주세요.
