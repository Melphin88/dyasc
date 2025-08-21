# 🎓 대학 입시 성적 분석 시스템

내신과 수능 성적을 바탕으로 맞춤형 대학을 추천받을 수 있는 웹 애플리케이션입니다.

## ✨ 주요 기능

- 📊 **성적 입력 및 분석**: 내신과 수능 성적을 간편하게 입력
- 🎯 **맞춤형 대학 추천**: 개인 성적에 맞는 수시/정시 대학 추천
- 📈 **상세 분석 리포트**: 합격 가능성 분석 및 전략 제안
- 🖨️ **인쇄용 보고서**: A4 형태의 상세 분석 보고서
- 👨‍💼 **관리자 패널**: 대학 데이터 관리 및 CSV 업로드
- 📱 **반응형 디자인**: 모바일부터 데스크탑까지 최적화

## 🚀 배포 링크

- **Production**: [https://university-analysis.netlify.app](https://university-analysis.netlify.app)
- **Staging**: [https://dev-university-analysis.netlify.app](https://dev-university-analysis.netlify.app)

## 🛠️ 기술 스택

### Frontend
- **React 18** + **TypeScript**
- **Vite** (빌드 도구)
- **Tailwind CSS v4** (스타일링)
- **Shadcn/ui** (UI 컴포넌트)
- **Recharts** (차트/그래프)
- **Lucide React** (아이콘)

### Backend
- **Supabase** (데이터베이스, 인증, Edge Functions)
- **Hono** (서버 프레임워크)
- **PostgreSQL** (데이터베이스)

### DevOps
- **Netlify** (호스팅 및 배포)
- **GitHub Actions** (CI/CD)
- **TypeScript** (타입 체크)

## 📦 설치 및 실행

### 1. 프로젝트 클론
```bash
git clone https://github.com/your-username/university-analysis.git
cd university-analysis
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경변수 설정
```bash
cp .env.example .env
```

`.env` 파일을 열어 Supabase 정보를 입력하세요:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. 개발 서버 실행
```bash
npm run dev
```

브라우저에서 http://localhost:5173 으로 접속하세요.

## 🗂️ 프로젝트 구조

```
university-analysis/
├── components/              # React 컴포넌트
│   ├── ui/                 # Shadcn UI 컴포넌트
│   ├── AdminPanel.tsx      # 관리자 패널
│   ├── AnalysisReport.tsx  # 분석 리포트
│   ├── GradeInput.tsx      # 성적 입력
│   └── ...
├── supabase/               # Supabase 설정
│   └── functions/          # Edge Functions
├── utils/                  # 유틸리티 함수
├── types/                  # TypeScript 타입
├── styles/                 # 스타일 파일
└── public/                 # 정적 파일
```

## 🔧 Supabase 설정

### 1. Supabase 프로젝트 생성
1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. Project URL과 API Keys 복사

### 2. Edge Functions 배포
```bash
# Supabase CLI 설치
npm install -g supabase

# 로그인
supabase login

# 프로젝트 연결
supabase link --project-ref your-project-id

# Edge Functions 배포
supabase functions deploy server
```

### 3. 데이터베이스 스키마
KV Store 테이블이 자동으로 생성됩니다. 추가 설정은 필요하지 않습니다.

## 🌐 Netlify 배포

### 1. GitHub 연결
1. GitHub에 코드 푸시
2. [Netlify](https://netlify.com)에서 새 사이트 생성
3. GitHub 저장소 연결

### 2. 빌드 설정
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: `20`

### 3. 환경변수 설정
Netlify Dashboard > Site Settings > Environment Variables에서 설정:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 🎮 사용법

### 학생 계정
1. **로그인**: 기본 계정 (`student1` / `pass123`) 또는 관리자가 생성한 계정
2. **성적 입력**: 내신과 수능 성적 입력
3. **대학 추천**: 맞춤형 대학 추천 확인
4. **리포트 확인**: 상세 분석 리포트 및 인쇄용 보고서

### 관리자 계정
1. **관리자 로그인**: 비밀번호 `admin123`
2. **계정 관리**: 학생 계정 생성/삭제
3. **데이터 관리**: CSV 파일로 대학 데이터 업로드
4. **리포트 관리**: 모든 학생의 성적 리포트 확인

## 📊 대학 데이터 형식

### 수시 데이터 (CSV)
```csv
대학명,학과명,내신등급,경쟁률,지역,특징,반영비율
서울대학교,컴퓨터공학부,1.5,15.2,서울특별시,최고 수준의 교육,수학40% 과학30%
```

### 정시 데이터 (CSV)
```csv
대학명,학과명,수능등급,경쟁률,군,지역,특징,반영비율
서울대학교,자연과학대학,1.2,8.5,가,서울특별시,기초과학 연구,수학45% 과학30%
```

## 🔍 성능 최적화

- **청크 단위 데이터 처리**: 대용량 CSV 파일 안전 업로드
- **결과 캐싱**: 1시간 TTL로 검색 성능 향상
- **코드 스플리팅**: 초기 로딩 시간 최적화
- **이미지 최적화**: WebP 형식 및 lazy loading
- **SEO 최적화**: Meta tags 및 OpenGraph 설정

## 🧪 테스트

```bash
# 타입 체크
npm run type-check

# 린팅
npm run lint

# 빌드 테스트
npm run build
npm run preview
```

## 📈 모니터링

- **성능 모니터링**: Lighthouse CI
- **에러 추적**: Console 로깅
- **사용자 분석**: 선택사항 (Google Analytics)

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

## 📞 지원

문제가 있거나 질문이 있으시면 [Issues](https://github.com/your-username/university-analysis/issues)를 통해 문의해주세요.

## 🔗 관련 링크

- [Supabase Documentation](https://supabase.com/docs)
- [Netlify Documentation](https://docs.netlify.com)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Shadcn/ui](https://ui.shadcn.com)

---

Made with ❤️ by University Analysis Team