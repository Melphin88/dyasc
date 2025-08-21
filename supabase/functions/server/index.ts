import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

// CORS 설정
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://*.netlify.app', 'https://*.supabase.co'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// 로깅 설정
app.use('*', logger(console.log));

// Supabase 클라이언트 생성
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// 인증 미들웨어
const requireAuth = async (c: any, next: any) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return c.json({ error: '인증이 필요합니다.' }, 401);
  }

  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (!user || error) {
    return c.json({ error: '유효하지 않은 토큰입니다.' }, 401);
  }

  c.set('user', user);
  await next();
};

// 관리자 인증 확인
const isAdmin = (password: string): boolean => {
  return password === 'admin123';
};

// 대학 데이터 압축 및 인덱싱 유틸리티
const compressUniversityData = (universities: any[]) => {
  return universities.map(uni => ({
    id: uni.id || `${uni.대학명}-${uni.학과명}`,
    name: uni.대학명 || uni.name,
    dept: uni.학과명 || uni.department,
    type: uni.전형구분 || uni.admissionType,
    grade: parseFloat(uni.내신등급 || uni.requiredGrade || '3.0'),
    rate: parseFloat(uni.경쟁률 || uni.competitionRate || '5.0'),
    location: uni.지역 || uni.location || '서울',
    year: uni.년도 || uni.year || 2024,
    students: parseInt(uni.모집인원 || uni.capacity || '30'),
    // 기타 필수 필드들 압축
    meta: {
      strategy: uni.전략 || uni.strategy,
      reflection: uni.반영비율 || uni.reflectionRatio,
      subjects: uni.필수과목 || uni.requiredSubjects,
      factors: uni.전형요소 || uni.additionalFactors
    }
  }));
};

// 대학 데이터 검색 최적화 함수
const searchUniversities = async (type: 'susi' | 'jungsi', studentGPA: number, suneungGrade: number, limit: number = 20) => {
  try {
    // 캐시된 데이터 먼저 확인
    const cacheKey = `universities_${type}_${Math.floor(studentGPA * 10)}_${Math.floor(suneungGrade * 10)}`;
    const cached = await kv.get(cacheKey);
    
    if (cached) {
      console.log(`캐시에서 ${type} 대학 데이터 반환`);
      return JSON.parse(cached);
    }

    // 전체 데이터 로드
    const allData = await kv.get(`universities_${type}_all`);
    if (!allData) {
      console.log(`${type} 대학 데이터가 없습니다.`);
      return [];
    }

    const universities = JSON.parse(allData);
    console.log(`${type} 대학 총 ${universities.length}개 로드`);

    // 학생 성적 기반 필터링 및 점수 계산
    const scoredUniversities = universities.map((uni: any) => {
      let matchScore = 0;
      const requiredGrade = uni.grade || 3.0;
      const competitionRate = uni.rate || 5.0;

      if (type === 'susi') {
        // 수시: 내신 70%, 경쟁률 30%
        const gradeScore = Math.max(0, 100 - Math.abs(studentGPA - requiredGrade) * 20);
        const competitionPenalty = Math.min(30, competitionRate * 2);
        matchScore = gradeScore - competitionPenalty;
      } else {
        // 정시: 수능 80%, 경쟁률 20%
        const suneungScore = Math.max(0, 100 - Math.abs(suneungGrade - requiredGrade) * 25);
        const competitionPenalty = Math.min(20, competitionRate * 1.5);
        matchScore = suneungScore - competitionPenalty;
      }

      return {
        ...uni,
        matchScore: Math.max(0, Math.round(matchScore))
      };
    });

    // 점수순 정렬 후 상위 대학들 선택
    const filtered = scoredUniversities
      .filter((uni: any) => uni.matchScore > 0)
      .sort((a: any, b: any) => b.matchScore - a.matchScore)
      .slice(0, limit);

    // 결과 캐싱 (1시간)
    await kv.set(cacheKey, JSON.stringify(filtered), { ttl: 3600 });

    console.log(`${type} 대학 ${filtered.length}개 추천 완료`);
    return filtered;

  } catch (error) {
    console.error(`대학 검색 오류 (${type}):`, error);
    return [];
  }
};

// 대용량 CSV 업로드 처리 (청크 단위)
app.post('/make-server-72188212/admin/upload-universities', async (c) => {
  try {
    const { password, data, type, isComplete, chunkIndex } = await c.req.json();
    
    if (!isAdmin(password)) {
      return c.json({ error: '관리자 권한이 필요합니다.' }, 403);
    }

    console.log(`대학 데이터 업로드 - 타입: ${type}, 청크: ${chunkIndex}, 완료: ${isComplete}`);

    if (!data || !Array.isArray(data)) {
      return c.json({ error: '올바른 데이터 형식이 아닙니다.' }, 400);
    }

    // 기존 청크 데이터 가져오기
    const chunkKey = `universities_${type}_chunks`;
    const existingChunks = await kv.get(chunkKey) || '[]';
    const chunks = JSON.parse(existingChunks);

    // 현재 청크 추가
    const compressedData = compressUniversityData(data);
    chunks.push(...compressedData);

    // 청크 데이터 저장
    await kv.set(chunkKey, JSON.stringify(chunks));

    // 업로드 완료 시 최종 처리
    if (isComplete) {
      console.log(`${type} 대학 데이터 최종 처리 시작 - 총 ${chunks.length}개`);

      // 데이터 정렬 및 인덱싱
      const sortedData = chunks.sort((a: any, b: any) => {
        // 성적 기준으로 정렬
        if (a.grade !== b.grade) return a.grade - b.grade;
        return a.rate - b.rate; // 경쟁률 기준 보조 정렬
      });

      // 최종 데이터 저장
      await kv.set(`universities_${type}_all`, JSON.stringify(sortedData));

      // 성적 구간별 인덱스 생성 (검색 성능 최적화)
      const gradeIndexes: { [key: string]: any[] } = {};
      sortedData.forEach((uni: any) => {
        const gradeRange = Math.floor(uni.grade);
        if (!gradeIndexes[gradeRange]) {
          gradeIndexes[gradeRange] = [];
        }
        gradeIndexes[gradeRange].push(uni);
      });

      // 인덱스 저장
      for (const [grade, unis] of Object.entries(gradeIndexes)) {
        await kv.set(`universities_${type}_grade_${grade}`, JSON.stringify(unis));
      }

      // 청크 임시 데이터 삭제
      await kv.del(chunkKey);

      // 기존 캐시 무효화
      const cacheKeys = await kv.getByPrefix(`universities_${type}_`);
      for (const key of cacheKeys) {
        if (key.includes('_cache_')) {
          await kv.del(key);
        }
      }

      console.log(`✅ ${type} 대학 데이터 업로드 완료 - ${sortedData.length}개`);
      
      return c.json({ 
        success: true, 
        message: `${type} 대학 ${sortedData.length}개 업로드 완료`,
        totalUniversities: sortedData.length
      });
    }

    return c.json({ 
      success: true, 
      message: `청크 ${chunkIndex} 업로드 완료`,
      chunksReceived: chunks.length
    });

  } catch (error) {
    console.error('대학 데이터 업로드 오류:', error);
    return c.json({ error: '업로드 처리 중 오류가 발생했습니다.' }, 500);
  }
});

// 수시 대학 추천 API (최적화됨)
app.get('/make-server-72188212/universities/susi', async (c) => {
  try {
    const studentGPA = parseFloat(c.req.query('gpa') || '3.0');
    const suneungGrade = parseFloat(c.req.query('suneung') || '3.0');
    const limit = parseInt(c.req.query('limit') || '20');

    console.log(`수시 대학 추천 요청 - 내신: ${studentGPA}, 수능: ${suneungGrade}`);

    const universities = await searchUniversities('susi', studentGPA, suneungGrade, limit);
    
    return c.json({
      success: true,
      universities,
      totalRecommended: universities.length,
      studentInfo: { gpa: studentGPA, suneung: suneungGrade }
    });

  } catch (error) {
    console.error('수시 대학 추천 오류:', error);
    return c.json({ error: '수시 대학 추천 중 오류가 발생했습니다.' }, 500);
  }
});

// 정시 대학 추천 API (군별)
app.get('/make-server-72188212/universities/jungsi', async (c) => {
  try {
    const studentGPA = parseFloat(c.req.query('gpa') || '3.0');
    const suneungGrade = parseFloat(c.req.query('suneung') || '3.0');
    const group = c.req.query('group') || 'all'; // ga, na, da, all

    console.log(`정시 대학 추천 요청 - 내신: ${studentGPA}, 수능: ${suneungGrade}, 군: ${group}`);

    if (group === 'all') {
      // 모든 군의 대학 가져오기
      const allUniversities = await searchUniversities('jungsi', studentGPA, suneungGrade, 60);
      
      // 군별로 분류 (가정: 대학 데이터에 group 필드가 있다고 가정)
      const result = {
        ga: allUniversities.filter((uni: any) => uni.group === 'ga' || uni.군 === '가').slice(0, 5),
        na: allUniversities.filter((uni: any) => uni.group === 'na' || uni.군 === '나').slice(0, 5),
        da: allUniversities.filter((uni: any) => uni.group === 'da' || uni.군 === '다').slice(0, 5)
      };

      // 각 군별로 5개씩 없으면 전체에서 분배
      const totalNeeded = 15;
      const currentTotal = result.ga.length + result.na.length + result.da.length;
      
      if (currentTotal < totalNeeded) {
        const remaining = allUniversities.slice(0, totalNeeded);
        // 군 정보가 없는 대학들을 균등 분배
        remaining.forEach((uni: any, index: number) => {
          const groupIndex = index % 3;
          if (groupIndex === 0 && result.ga.length < 5) result.ga.push(uni);
          else if (groupIndex === 1 && result.na.length < 5) result.na.push(uni);
          else if (groupIndex === 2 && result.da.length < 5) result.da.push(uni);
        });
      }

      return c.json({
        success: true,
        ga: result.ga,
        na: result.na,
        da: result.da,
        studentInfo: { gpa: studentGPA, suneung: suneungGrade }
      });
    } else {
      // 특정 군의 대학만 가져오기
      const universities = await searchUniversities('jungsi', studentGPA, suneungGrade, 5);
      const filtered = universities.filter((uni: any) => uni.group === group || uni.군 === group);
      
      return c.json({
        success: true,
        universities: filtered,
        group,
        studentInfo: { gpa: studentGPA, suneung: suneungGrade }
      });
    }

  } catch (error) {
    console.error('정시 대학 추천 오류:', error);
    return c.json({ error: '정시 대학 추천 중 오류가 발생했습니다.' }, 500);
  }
});

// 대학 상세 정보 API
app.get('/make-server-72188212/university/:id', async (c) => {
  try {
    const universityId = c.req.param('id');
    const type = c.req.query('type') || 'susi';

    // 전체 데이터에서 해당 대학 찾기
    const allData = await kv.get(`universities_${type}_all`);
    if (!allData) {
      return c.json({ error: '대학 데이터를 찾을 수 없습니다.' }, 404);
    }

    const universities = JSON.parse(allData);
    const university = universities.find((uni: any) => uni.id === universityId);

    if (!university) {
      return c.json({ error: '해당 대학을 찾을 수 없습니다.' }, 404);
    }

    return c.json({
      success: true,
      university: {
        ...university,
        // 상세 정보 추가
        details: university.meta || {}
      }
    });

  } catch (error) {
    console.error('대학 상세 정보 조회 오류:', error);
    return c.json({ error: '대학 정보 조회 중 오류가 발생했습니다.' }, 500);
  }
});

// 성적 저장 API
app.post('/make-server-72188212/save-scores', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { scores } = await c.req.json();

    const userKey = `user_scores_${user.id}`;
    const existingScores = await kv.get(userKey) || '{}';
    const currentScores = JSON.parse(existingScores);

    const updatedScores = {
      ...currentScores,
      ...scores,
      updatedAt: new Date().toISOString()
    };

    await kv.set(userKey, JSON.stringify(updatedScores));

    return c.json({
      success: true,
      message: '성적이 저장되었습니다.',
      scores: updatedScores
    });

  } catch (error) {
    console.error('성적 저장 오류:', error);
    return c.json({ error: '성적 저장 중 오류가 발생했습니다.' }, 500);
  }
});

// 내 성적 조회 API
app.get('/make-server-72188212/my-scores', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const userKey = `user_scores_${user.id}`;
    const scores = await kv.get(userKey) || '{}';

    return c.json({
      success: true,
      scores: {
        userId: user.id,
        scores: JSON.parse(scores)
      }
    });

  } catch (error) {
    console.error('성적 조회 오류:', error);
    return c.json({ error: '성적 조회 중 오류가 발생했습니다.' }, 500);
  }
});

// 시스템 상태 확인 API
app.get('/make-server-72188212/status', async (c) => {
  try {
    const susiData = await kv.get('universities_susi_all');
    const jungsiData = await kv.get('universities_jungsi_all');
    
    const susiCount = susiData ? JSON.parse(susiData).length : 0;
    const jungsiCount = jungsiData ? JSON.parse(jungsiData).length : 0;

    return c.json({
      success: true,
      status: 'healthy',
      data: {
        susiUniversities: susiCount,
        jungsiUniversities: jungsiCount,
        totalUniversities: susiCount + jungsiCount,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('시스템 상태 확인 오류:', error);
    return c.json({ error: '시스템 상태 확인 중 오류가 발생했습니다.' }, 500);
  }
});

// 헬스체크
app.get('/make-server-72188212/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

console.log('🚀 대학 입시 분석 서버 시작 - 대용량 데이터 최적화 버전');

Deno.serve(app.fetch);