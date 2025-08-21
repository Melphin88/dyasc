# 🚀 배포 가이드

이 가이드는 대학 입시 성적 분석 시스템을 GitHub → Netlify → Supabase로 배포하는 전체 과정을 설명합니다.

## 📋 배포 체크리스트

- [ ] GitHub 저장소 생성
- [ ] Supabase 프로젝트 설정
- [ ] Netlify 사이트 연결
- [ ] 환경변수 설정
- [ ] Edge Functions 배포
- [ ] 도메인 설정 (선택사항)
- [ ] 테스트 및 검증

## 1️⃣ GitHub 저장소 설정

### 1.1 새 저장소 생성
```bash
# GitHub에서 새 저장소 생성 후
git clone https://github.com/your-username/university-analysis.git
cd university-analysis

# 코드 복사 후 초기 커밋
git add .
git commit -m "Initial commit: University analysis system"
git push origin main
```

### 1.2 GitHub Secrets 설정 (CI/CD용)
GitHub Repository > Settings > Secrets and variables > Actions에서 설정:

```
SUPABASE_ACCESS_TOKEN=your-supabase-access-token
SUPABASE_PROJECT_ID=your-project-id
NETLIFY_AUTH_TOKEN=your-netlify-auth-token
NETLIFY_SITE_ID=your-site-id
```

## 2️⃣ Supabase 프로젝트 설정

### 2.1 프로젝트 생성
1. [Supabase Dashboard](https://supabase.com/dashboard)에서 "New Project" 클릭
2. 프로젝트 정보 입력:
   - **Name**: `university-analysis`
   - **Database Password**: 강력한 비밀번호 생성
   - **Region**: 가장 가까운 지역 (예: Northeast Asia, Seoul)

### 2.2 API Keys 확인
Project Settings > API에서 다음 정보 복사:
- **Project URL**: `https://xxx.supabase.co`
- **Anon key**: `eyJhbGc...` (public용)
- **Service role key**: `eyJhbGc...` (private용, 서버에서만 사용)

### 2.3 Edge Functions 배포

#### Supabase CLI 설치 및 로그인
```bash
# Supabase CLI 설치
npm install -g supabase

# 로그인 (브라우저가 열리고 토큰 입력)
supabase login

# 프로젝트 연결
supabase link --project-ref your-project-id
```

#### Edge Functions 배포
```bash
# 서버 함수 배포
supabase functions deploy server

# 배포 확인
supabase functions list
```

### 2.4 데이터베이스 스키마 확인
KV Store 테이블이 자동으로 생성됩니다. SQL Editor에서 확인:
```sql
SELECT * FROM kv_store_72188212 LIMIT 5;
```

### 2.5 RLS (Row Level Security) 설정
```sql
-- KV Store 테이블에 대한 정책 설정
ALTER TABLE kv_store_72188212 ENABLE ROW LEVEL SECURITY;

-- 서비스 역할에 대한 모든 권한 허용
CREATE POLICY "Service role access" ON kv_store_72188212
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- 인증된 사용자에 대한 읽기 권한
CREATE POLICY "Authenticated read access" ON kv_store_72188212
FOR SELECT TO authenticated
USING (true);
```

## 3️⃣ Netlify 배포 설정

### 3.1 Netlify 계정 생성 및 사이트 연결
1. [Netlify](https://app.netlify.com)에 로그인
2. "New site from Git" 클릭
3. GitHub 저장소 선택
4. 빌드 설정:
   - **Branch**: `main`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

### 3.2 환경변수 설정
Site Settings > Environment variables에서 설정:

```env
# Supabase 설정
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 애플리케이션 설정
VITE_APP_TITLE=대학 입시 성적 분석 시스템
VITE_DEVELOPMENT_MODE=false

# 빌드 설정
NODE_VERSION=20
NPM_VERSION=10
```

### 3.3 빌드 설정 확인
netlify.toml 파일이 자동으로 적용됩니다. 추가 설정:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  
[build.environment]
  NODE_VERSION = "20"
  NPM_VERSION = "10"
```

### 3.4 도메인 설정 (선택사항)
1. Site Settings > Domain management
2. Custom domain 추가
3. DNS 설정 (A record 또는 CNAME)
4. SSL 인증서 자동 발급 확인

## 4️⃣ 배포 검증

### 4.1 기능 테스트
- [ ] 메인 페이지 로딩
- [ ] 학생 로그인 (`student1` / `pass123`)
- [ ] 관리자 로그인 (`admin123`)
- [ ] 성적 입력 및 저장
- [ ] 대학 추천 기능
- [ ] 리포트 생성
- [ ] CSV 업로드 (관리자)

### 4.2 성능 검증
```bash
# Lighthouse 점수 확인
npx lighthouse https://your-site.netlify.app --view

# 빌드 사이즈 확인
npm run build
```

### 4.3 모바일 반응형 테스트
- [ ] iPhone (375px)
- [ ] iPad (768px)
- [ ] Desktop (1024px+)

## 5️⃣ 모니터링 설정

### 5.1 Netlify Analytics
Site Settings > Analytics에서 활성화

### 5.2 Error Monitoring
```javascript
// main.tsx에 에러 핸들링 추가
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // Sentry나 다른 에러 추적 서비스로 전송
});
```

### 5.3 Performance Monitoring
```javascript
// Web Vitals 측정
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

## 6️⃣ CI/CD 파이프라인

### 6.1 GitHub Actions Workflow
`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Netlify

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Type check
      run: npm run type-check
    
    - name: Lint
      run: npm run lint
    
    - name: Build
      run: npm run build
      env:
        VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
        VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
    
    - name: Deploy to Netlify
      uses: nwtgck/actions-netlify@v2.0
      with:
        publish-dir: './dist'
        production-branch: main
        github-token: ${{ secrets.GITHUB_TOKEN }}
        deploy-message: "Deploy from GitHub Actions"
      env:
        NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

## 7️⃣ 보안 체크리스트

### 7.1 환경변수 보안
- [ ] Service Role Key는 서버에서만 사용
- [ ] Anon Key는 클라이언트에서 사용
- [ ] .env 파일은 .gitignore에 포함
- [ ] 프로덕션과 개발 환경 분리

### 7.2 Supabase 보안
- [ ] RLS (Row Level Security) 활성화
- [ ] 적절한 정책 설정
- [ ] 불필요한 API 엔드포인트 비활성화
- [ ] 정기적인 보안 업데이트

### 7.3 Netlify 보안
- [ ] HTTPS 강제 적용
- [ ] Security Headers 설정
- [ ] Access Control 설정 (필요시)

## 8️⃣ 문제 해결

### 8.1 일반적인 빌드 오류

**Node.js 버전 문제**
```bash
# .nvmrc 파일 생성
echo "20" > .nvmrc

# Netlify에서 NODE_VERSION 환경변수 설정
NODE_VERSION=20
```

**종속성 문제**
```bash
# package-lock.json 삭제 후 재설치
rm package-lock.json
npm install
```

**환경변수 문제**
```bash
# 로컬에서 환경변수 확인
npm run dev

# Netlify에서 환경변수 확인
netlify env:list
```

### 8.2 Supabase 연결 문제

**CORS 에러**
```javascript
// 개발 환경에서 CORS 우회
if (import.meta.env.DEV) {
  // 개발용 설정
} else {
  // 프로덕션용 설정
}
```

**Edge Functions 오류**
```bash
# 로그 확인
supabase functions logs server

# 재배포
supabase functions deploy server --no-verify-jwt
```

### 8.3 성능 최적화

**번들 사이즈 최적화**
```javascript
// vite.config.ts에서 코드 스플리팅 설정
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ui-vendor': ['@radix-ui/react-*'],
          'chart-vendor': ['recharts']
        }
      }
    }
  }
})
```

## 9️⃣ 유지보수

### 9.1 정기 업데이트
- [ ] 월 1회 종속성 업데이트
- [ ] Supabase 프로젝트 모니터링
- [ ] 성능 지표 확인
- [ ] 보안 패치 적용

### 9.2 백업 전략
- [ ] 데이터베이스 정기 백업
- [ ] 소스코드 버전 관리
- [ ] 환경설정 문서화

### 9.3 모니터링
- [ ] 업타임 모니터링
- [ ] 에러율 추적
- [ ] 사용자 피드백 수집

## 🎉 배포 완료!

모든 단계를 완료하면 다음 URL에서 애플리케이션에 접근할 수 있습니다:
- **Netlify URL**: `https://your-site.netlify.app`
- **Custom Domain**: `https://your-domain.com` (설정한 경우)

문제가 발생하면 [이슈 트래커](https://github.com/your-username/university-analysis/issues)에 문의해주세요.