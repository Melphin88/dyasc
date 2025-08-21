import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { UniversityCard, University } from './UniversityCard';
import { GradeData } from './GradeInput';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { ChevronDown, ChevronUp, Target, TrendingUp, AlertCircle, CheckCircle, User, MapPin, School, BookOpen, Loader2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { projectId, publicAnonKey, isSupabaseConfigured, isDevelopmentMode } from '../utils/supabase/info';

interface AnalysisReportProps {
  studentId?: string;
  studentName?: string;
  grades?: GradeData;
  simpleGradeData?: any;
  simpleSuneungData?: any;
  onBack?: () => void;
}

interface DetailedUniversity extends University {
  requirements: {
    minInternalGrade?: number;
    minSuneungGrade?: number;
    requiredSubjects?: string[];
    additionalFactors?: string[];
  };
  admissionStrategy: string;
  competitionAnalysis: string;
  recommendation: 'safe' | 'optimal' | 'challenge';
  reflectionRatio?: string;
  admissionData?: {
    lastYear: { score: number; students: number };
    threeYearAvg: { score: number; students: number };
    yearlyData: Array<{ year: number; score: number; students: number }>;
  };
}

// 반영비율 분석 함수
const calculateBestReflectionRatio = (grades: GradeData, type: 'school' | 'suneung') => {
  if (type === 'school') {
    const subjects = ['국어', '영어', '수학', '사회', '과학'];
    const subjectAverages = subjects.map(subject => {
      let total = 0;
      let count = 0;
      
      // 1학년
      const grade1S1 = grades.school.grade1.semester1[subject];
      const grade1S2 = grades.school.grade1.semester2[subject];
      if (grade1S1?.grade) { total += grade1S1.grade; count++; }
      if (grade1S2?.grade) { total += grade1S2.grade; count++; }
      
      // 2,3학년 (1,2,3으로 분류된 것들)
      [1, 2, 3].forEach(num => {
        const subjectName = `${subject}${num}`;
        const grade2S1 = grades.school.grade2.semester1[subjectName];
        const grade2S2 = grades.school.grade2.semester2[subjectName];
        const grade3S1 = grades.school.grade3.semester1[subjectName];
        const grade3S2 = grades.school.grade3.semester2[subjectName];
        
        if (grade2S1?.grade) { total += grade2S1.grade; count++; }
        if (grade2S2?.grade) { total += grade2S2.grade; count++; }
        if (grade3S1?.grade) { total += grade3S1.grade; count++; }
        if (grade3S2?.grade) { total += grade3S2.grade; count++; }
      });
      
      return {
        subject,
        average: count > 0 ? Number((total / count).toFixed(2)) : 9
      };
    });
    
    // 성적이 좋은 순으로 정렬
    subjectAverages.sort((a, b) => a.average - b.average);
    return `${subjectAverages[0].subject}(${subjectAverages[0].average}) > ${subjectAverages[1].subject}(${subjectAverages[1].average}) > ${subjectAverages[2].subject}(${subjectAverages[2].average})`;
  } else {
    const subjects = [
      { name: '국어', grade: grades.suneung.korean.grade },
      { name: '수학', grade: grades.suneung.math.grade },
      { name: '영어', grade: grades.suneung.english.grade },
      { name: '사회', grade: Math.min(grades.suneung.inquiry1.grade, grades.suneung.inquiry2.grade) },
      { name: '과학', grade: Math.min(grades.suneung.inquiry1.grade, grades.suneung.inquiry2.grade) }
    ];
    
    const validSubjects = subjects.filter(s => s.grade > 0).sort((a, b) => a.grade - b.grade);
    return validSubjects.slice(0, 3).map(s => `${s.name}(${s.grade}등급)`).join(' > ');
  }
};

// 합격 가능성에 따른 색상 결정
const getAdmissionProbabilityColor = (matchPercentage: number) => {
  if (matchPercentage >= 80) return 'bg-green-600'; // 진한녹색 - 합격률 80% 이상
  if (matchPercentage >= 50) return 'bg-green-300'; // 연한녹색 - 합격률 50-79%
  if (matchPercentage >= 20) return 'bg-yellow-400'; // 노랑색 - 합격률 20-49%
  return 'bg-red-500'; // 붉은색 - 합격률 20% 미만
};

// 학생 성적과 대학 요구 성적 비교하여 합격 가능성 계산
const calculateMatchPercentage = (studentGPA: number, suneungAverage: number, university: any): number => {
  // 수시의 경우 내신 위주, 정시의 경우 수능 위주로 계산
  const isJungsi = university.admissionType?.includes('정시');
  
  let matchScore = 0;
  
  if (isJungsi) {
    // 정시: 수능 성적 위주 (80%), 내신 (20%)
    const suneungMatch = Math.max(0, 100 - Math.abs(suneungAverage - (university.requiredSuneungGrade || university.requiredGrade || 3)) * 25);
    const gradeMatch = Math.max(0, 100 - Math.abs(studentGPA - (university.requiredGrade || 3)) * 15);
    matchScore = suneungMatch * 0.8 + gradeMatch * 0.2;
  } else {
    // 수시: 내신 위주 (70%), 수능 (30%)
    const gradeMatch = Math.max(0, 100 - Math.abs(studentGPA - (university.requiredGrade || 3)) * 20);
    const suneungMatch = Math.max(0, 100 - Math.abs(suneungAverage - (university.requiredSuneungGrade || university.requiredGrade || 3)) * 20);
    matchScore = gradeMatch * 0.7 + suneungMatch * 0.3;
  }
  
  // 경쟁률 반영 (경쟁률이 높을수록 합격 가능성 감소)
  const competitionPenalty = Math.min(20, (university.competitionRate || 5) * 2);
  matchScore = Math.max(0, matchScore - competitionPenalty);
  
  return Math.round(matchScore);
};

export function AnalysisReport({ studentId, studentName, grades, simpleGradeData, simpleSuneungData, onBack }: AnalysisReportProps) {
  const [activeTab, setActiveTab] = useState('susi');
  const [activeJungsiTab, setActiveJungsiTab] = useState('ga');
  const [expandedAnalysis, setExpandedAnalysis] = useState<{[key: string]: boolean}>({});
  const [isLoadingUniversities, setIsLoadingUniversities] = useState(false);
  const [susiUniversities, setSusiUniversities] = useState<DetailedUniversity[]>([]);
  const [jungsiUniversities, setJungsiUniversities] = useState<{[key: string]: DetailedUniversity[]}>({ ga: [], na: [], da: [] });
  const reportRef = useRef<HTMLDivElement>(null);

  const calculateSchoolGPA = (): number => {
    if (simpleGradeData) {
      const allGrades: number[] = [];
      Object.values(simpleGradeData).forEach((subjectData) => {
        Object.values(subjectData).forEach(grade => {
          if (typeof grade === 'number' && grade > 0) {
            allGrades.push(grade);
          }
        });
      });
      return allGrades.length > 0 ? Number((allGrades.reduce((sum, grade) => sum + grade, 0) / allGrades.length).toFixed(2)) : 0;
    }
    
    if (!grades) return 0;
    
    let totalGrade = 0;
    let totalCredits = 0;

    Object.values(grades.school).forEach(grade => {
      Object.values(grade).forEach(semester => {
        Object.values(semester).forEach(subject => {
          if (subject.grade && subject.credits) {
            totalGrade += subject.grade * subject.credits;
            totalCredits += subject.credits;
          }
        });
      });
    });

    return totalCredits > 0 ? Number((totalGrade / totalCredits).toFixed(2)) : 0;
  };

  const calculateSuneungAverage = (): number => {
    if (simpleSuneungData) {
      const validScores = [simpleSuneungData.korean, simpleSuneungData.math, simpleSuneungData.english, simpleSuneungData.inquiry1, simpleSuneungData.inquiry2].filter(score => score > 0);
      return validScores.length > 0 ? Number((validScores.reduce((sum, score) => sum + score, 0) / validScores.length).toFixed(2)) : 0;
    }
    
    if (!grades) return 0;
    
    const subjects = Object.values(grades.suneung);
    const validGrades = subjects.filter(subject => subject.grade > 0);
    
    if (validGrades.length === 0) return 0;
    
    const totalGrade = validGrades.reduce((sum, subject) => sum + subject.grade, 0);
    return Number((totalGrade / validGrades.length).toFixed(2));
  };

  // Supabase에서 실제 대학 데이터 가져오기
  const loadUniversityData = async () => {
    if (isDevelopmentMode() || !isSupabaseConfigured()) {
      console.log('🔧 개발 모드: 목업 대학 데이터 사용 중');
      loadMockUniversityData();
      return;
    }

    setIsLoadingUniversities(true);
    try {
      console.log('🌐 Supabase에서 실제 대학 데이터 로딩 중...');
      
      // 수시 대학 데이터 가져오기
      const susiResponse = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-72188212/universities/susi`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });
      
      if (susiResponse.ok) {
        const susiData = await susiResponse.json();
        const processedSusiUniversities = processSuneungUniversityData(susiData.universities || [], 'susi');
        setSusiUniversities(processedSusiUniversities);
      }

      // 정시 대학 데이터 가져오기
      const jungsiResponse = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-72188212/universities/jungsi`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });
      
      if (jungsiResponse.ok) {
        const jungsiData = await jungsiResponse.json();
        const processedJungsiUniversities = {
          ga: processSuneungUniversityData(jungsiData.ga || [], 'jungsi'),
          na: processSuneungUniversityData(jungsiData.na || [], 'jungsi'),
          da: processSuneungUniversityData(jungsiData.da || [], 'jungsi')
        };
        setJungsiUniversities(processedJungsiUniversities);
      }

      console.log('✅ 실제 대학 데이터 로딩 완료');
    } catch (error) {
      console.warn('⚠️ 실제 대학 데이터 로딩 실패, 목업 데이터로 대체:', error);
      loadMockUniversityData();
    } finally {
      setIsLoadingUniversities(false);
    }
  };

  // 실제 대학 데이터 처리 및 학생 성적과 매칭
  const processSuneungUniversityData = (universities: any[], type: 'susi' | 'jungsi'): DetailedUniversity[] => {
    const schoolGPA = calculateSchoolGPA();
    const suneungAverage = calculateSuneungAverage();

    return universities.map((university: any) => {
      const matchPercentage = calculateMatchPercentage(schoolGPA, suneungAverage, university);
      
      return {
        name: university.대학명 || university.name,
        department: university.학과명 || university.department,
        admissionType: type === 'susi' ? '수시' : university.군 ? `정시 ${university.군}군` : '정시',
        competitionRate: university.경쟁률 || university.competitionRate || 5,
        requiredGrade: university.내신등급 || university.requiredGrade || 3,
        matchPercentage,
        location: university.지역 || university.location || '서울특별시',
        description: university.특징 || university.description || '우수한 교육 프로그램을 제공합니다.',
        requirements: {
          minInternalGrade: university.내신등급 || university.requiredGrade,
          minSuneungGrade: university.수능등급 || university.requiredSuneungGrade,
          requiredSubjects: university.필수과목 || university.requiredSubjects || ['국어', '수학', '영어'],
          additionalFactors: university.전형요소 || university.additionalFactors || ['학교생활기록부', '자기소개서']
        },
        admissionStrategy: university.전략 || university.strategy || `${university.대학명 || university.name}의 입시 전략을 분석하여 맞춤형 준비가 필요합니다.`,
        competitionAnalysis: university.경쟁분석 || university.analysis || '해당 학과는 안정적인 경쟁률을 보이고 있습니다.',
        recommendation: matchPercentage >= 70 ? 'safe' : matchPercentage >= 50 ? 'optimal' : 'challenge',
        reflectionRatio: university.반영비율 || university.reflectionRatio || '국어 25%, 수학 25%, 영어 25%, 탐구 25%',
        admissionData: {
          lastYear: { 
            score: university.작년등급 || university.lastYearGrade || 3.0, 
            students: university.작년인원 || university.lastYearStudents || 30 
          },
          threeYearAvg: { 
            score: university.삼년평균등급 || university.threeYearAvgGrade || 3.1, 
            students: university.삼년평균인원 || university.threeYearAvgStudents || 29 
          },
          yearlyData: university.연도별데이터 || university.yearlyData || [
            { year: 2022, score: 3.2, students: 28 },
            { year: 2021, score: 3.0, students: 30 }
          ]
        }
      } as DetailedUniversity;
    }).sort((a, b) => b.matchPercentage - a.matchPercentage).slice(0, 20); // 상위 20개만 선택
  };

  // 목업 데이터 로딩 (개발 모드용)
  const loadMockUniversityData = () => {
    const schoolGPA = calculateSchoolGPA();
    const suneungAverage = calculateSuneungAverage();

    // 기존 하드코딩된 데이터 사용
    const mockSusiUniversities: DetailedUniversity[] = [
      {
        name: '서울대학교',
        department: '컴퓨터공학부',
        admissionType: '수시',
        competitionRate: 15.2,
        requiredGrade: 1.5,
        matchPercentage: calculateMatchPercentage(schoolGPA, suneungAverage, { requiredGrade: 1.5, competitionRate: 15.2 }),
        location: '서울특별시',
        description: '국내 최고 수준의 컴퓨터공학 교육과 연구를 제공합니다.',
        requirements: {
          minInternalGrade: 1.5,
          requiredSubjects: ['수학', '과학'],
          additionalFactors: ['학교생활기록부', '자기소개서', '면접']
        },
        admissionStrategy: '서울대는 학생부종합전형에서 내신 1.5등급 이상을 요구하며, 특히 수학·과학 성적이 중요합니다.',
        competitionAnalysis: '최상위권 경쟁으로 전국 상위 1% 이내 학생들이 지원합니다.',
        recommendation: schoolGPA <= 1.5 ? 'optimal' : schoolGPA <= 2.0 ? 'challenge' : 'challenge',
        reflectionRatio: '수학 40%, 과학 30%, 국어 20%, 영어 10%',
        admissionData: {
          lastYear: { score: 1.45, students: 32 },
          threeYearAvg: { score: 1.48, students: 30 },
          yearlyData: [
            { year: 2022, score: 1.52, students: 28 },
            { year: 2021, score: 1.47, students: 31 }
          ]
        }
      },
      {
        name: '연세대학교',
        department: '경영학과',
        admissionType: '수시',
        competitionRate: 12.8,
        requiredGrade: 2.0,
        matchPercentage: calculateMatchPercentage(schoolGPA, suneungAverage, { requiredGrade: 2.0, competitionRate: 12.8 }),
        location: '서울특별시',
        description: '글로벌 리더십을 갖춘 경영인재를 양성합니다.',
        requirements: {
          minInternalGrade: 2.0,
          requiredSubjects: ['국어', '수학', '영어'],
          additionalFactors: ['학교생활기록부', '자기소개서', '면접']
        },
        admissionStrategy: '연세대 경영학과는 균형 잡힌 성적과 리더십 경험을 중시합니다.',
        competitionAnalysis: '상위권 경쟁이며, 특히 경영학과는 인기가 높아 경쟁률이 치열합니다.',
        recommendation: schoolGPA <= 2.0 ? 'optimal' : schoolGPA <= 2.5 ? 'challenge' : 'challenge',
        reflectionRatio: '국어 30%, 수학 30%, 영어 25%, 사회 15%',
        admissionData: {
          lastYear: { score: 1.95, students: 45 },
          threeYearAvg: { score: 1.98, students: 43 },
          yearlyData: [
            { year: 2022, score: 2.02, students: 41 },
            { year: 2021, score: 1.97, students: 44 }
          ]
        }
      },
      {
        name: '고려대학교',
        department: '경제학과',
        admissionType: '수시',
        competitionRate: 11.5,
        requiredGrade: 2.1,
        matchPercentage: calculateMatchPercentage(schoolGPA, suneungAverage, { requiredGrade: 2.1, competitionRate: 11.5 }),
        location: '서울특별시',
        description: '창의적 사고력을 갖춘 경제 전문가를 양성합니다.',
        requirements: {
          minInternalGrade: 2.1,
          requiredSubjects: ['국어', '수학', '사회'],
          additionalFactors: ['학교생활기록부', '자기소개서', '면접']
        },
        admissionStrategy: '고려대 경제학과는 논리적 사고력과 수리 능력을 중시합니다.',
        competitionAnalysis: '전국 상위 5% 이내 학생들이 주로 지원하는 인기 학과입니다.',
        recommendation: schoolGPA <= 2.1 ? 'optimal' : schoolGPA <= 2.6 ? 'challenge' : 'challenge',
        reflectionRatio: '수학 35%, 국어 30%, 사회 25%, 영어 10%',
        admissionData: {
          lastYear: { score: 2.05, students: 42 },
          threeYearAvg: { score: 2.08, students: 40 },
          yearlyData: [
            { year: 2022, score: 2.12, students: 38 },
            { year: 2021, score: 2.06, students: 41 }
          ]
        }
      }
      // 기존 하드코딩된 데이터 중 일부만 예시로 포함 (개발 모드용)
    ];

    // 합격 가능성 순으로 정렬
    mockSusiUniversities.sort((a, b) => b.matchPercentage - a.matchPercentage);
    setSusiUniversities(mockSusiUniversities);

    // 목업 정시 데이터
    const mockJungsiUniversities = {
      ga: [
        {
          name: '서울대학교',
          department: '자연과학대학',
          admissionType: '정시 가군',
          competitionRate: 8.5,
          requiredGrade: 1.2,
          matchPercentage: calculateMatchPercentage(schoolGPA, suneungAverage, { requiredGrade: 1.2, competitionRate: 8.5 }),
          location: '서울특별시',
          description: '기초과학 연구의 최고 수준을 자랑합니다.',
          requirements: {
            minSuneungGrade: 1.2,
            requiredSubjects: ['수학', '과학탐구'],
            additionalFactors: ['수능 최저학력기준']
          },
          admissionStrategy: '수능에서 수학과 과학탐구 영역이 특히 중요합니다.',
          competitionAnalysis: '자연계열 최상위권으로 수학·과학 만점자들이 대거 지원합니다.',
          recommendation: suneungAverage <= 1.5 ? 'optimal' : suneungAverage <= 2.0 ? 'challenge' : 'challenge',
          reflectionRatio: '수학 45%, 과학 30%, 국어 15%, 영어 10%',
          admissionData: {
            lastYear: { score: 1.15, students: 28 },
            threeYearAvg: { score: 1.18, students: 26 },
            yearlyData: [
              { year: 2022, score: 1.22, students: 24 },
              { year: 2021, score: 1.17, students: 27 }
            ]
          }
        } as DetailedUniversity
      ],
      na: [],
      da: []
    };

    setJungsiUniversities(mockJungsiUniversities);
  };

  // 컴포넌트 마운트 시 대학 데이터 로드
  useEffect(() => {
    loadUniversityData();
  }, [simpleGradeData, simpleSuneungData]);

  const getSchoolSubjectAverages = () => {
    if (simpleGradeData) {
      return Object.entries(simpleGradeData).map(([subject, data]) => {
        const grades = Object.values(data).filter(g => typeof g === 'number' && g > 0);
        const average = grades.length > 0 ? grades.reduce((sum: number, grade: number) => sum + grade, 0) / grades.length : 0;
        return {
          subject: subject.charAt(0).toUpperCase() + subject.slice(1),
          average: Number(average.toFixed(2)),
          nationalAverage: Math.random() * 2 + 2
        };
      }).filter(item => item.average > 0);
    }
    
    if (!grades) return [];
    
    const subjectTotals: { [key: string]: { total: number; count: number } } = {};
    
    // 1학년 과목들
    ['국어', '영어', '수학', '사회', '과학'].forEach(subject => {
      const grade1S1 = grades.school.grade1.semester1[subject];
      const grade1S2 = grades.school.grade1.semester2[subject];
      
      let total = 0;
      let count = 0;
      
      if (grade1S1?.grade) { total += grade1S1.grade; count++; }
      if (grade1S2?.grade) { total += grade1S2.grade; count++; }
      
      if (count > 0) {
        subjectTotals[subject] = { total, count };
      }
    });

    // 2,3학년 과목들 (1,2,3으로 분류된 것들)
    ['국어', '영어', '수학', '사회', '과학'].forEach(baseSubject => {
      [1, 2, 3].forEach(num => {
        const subject = `${baseSubject}${num}`;
        const grade2S1 = grades.school.grade2.semester1[subject];
        const grade2S2 = grades.school.grade2.semester2[subject];
        const grade3S1 = grades.school.grade3.semester1[subject];
        const grade3S2 = grades.school.grade3.semester2[subject];
        
        let total = 0;
        let count = 0;
        
        if (grade2S1?.grade) { total += grade2S1.grade; count++; }
        if (grade2S2?.grade) { total += grade2S2.grade; count++; }
        if (grade3S1?.grade) { total += grade3S1.grade; count++; }
        if (grade3S2?.grade) { total += grade3S2.grade; count++; }
        
        if (count > 0) {
          if (!subjectTotals[baseSubject]) {
            subjectTotals[baseSubject] = { total: 0, count: 0 };
          }
          subjectTotals[baseSubject].total += total;
          subjectTotals[baseSubject].count += count;
        }
      });
    });

    return Object.entries(subjectTotals).map(([subject, data]) => ({
      subject,
      average: Number((data.total / data.count).toFixed(2)),
      nationalAverage: Math.random() * 2 + 2 // 모의 전국 평균
    }));
  };

  const getSuneungSubjectData = () => {
    if (simpleSuneungData) {
      return [
        { subject: '국어', grade: simpleSuneungData.korean, percentile: 0 },
        { subject: '수학', grade: simpleSuneungData.math, percentile: 0 },
        { subject: '영어', grade: simpleSuneungData.english, percentile: 0 },
        { subject: '탐구1', grade: simpleSuneungData.inquiry1, percentile: 0 },
        { subject: '탐구2', grade: simpleSuneungData.inquiry2, percentile: 0 }
      ].filter(item => item.grade > 0);
    }
    
    if (!grades) return [];
    
    const subjects = [
      { subject: '국어', grade: grades.suneung.korean.grade, percentile: grades.suneung.korean.percentile },
      { subject: '수학', grade: grades.suneung.math.grade, percentile: grades.suneung.math.percentile },
      { subject: '영어', grade: grades.suneung.english.grade, percentile: grades.suneung.english.percentile },
      { subject: '한국사', grade: grades.suneung.koreanHistory.grade, percentile: grades.suneung.koreanHistory.percentile },
      { subject: '탐구1', grade: grades.suneung.inquiry1.grade, percentile: grades.suneung.inquiry1.percentile },
      { subject: '탐구2', grade: grades.suneung.inquiry2.grade, percentile: grades.suneung.inquiry2.percentile },
      { subject: '제2외국어', grade: grades.suneung.secondLanguage.grade, percentile: grades.suneung.secondLanguage.percentile }
    ];

    return subjects.filter(item => item.grade > 0);
  };

  const schoolGPA = calculateSchoolGPA();
  const suneungAverage = calculateSuneungAverage();
  const schoolSubjectAverages = getSchoolSubjectAverages();
  const suneungSubjectData = getSuneungSubjectData();

  // 유리한 반영비율 계산
  const schoolBestRatio = grades ? calculateBestReflectionRatio(grades, 'school') : '분석 데이터 부족';
  const suneungBestRatio = grades ? calculateBestReflectionRatio(grades, 'suneung') : '분석 데이터 부족';

  const toggleAnalysis = (universityKey: string) => {
    setExpandedAnalysis(prev => ({
      ...prev,
      [universityKey]: !prev[universityKey]
    }));
  };

  // 개인정보 표시 섹션
  const renderPersonalInfo = () => (
    <Card className="shadow-lg border-navy-200 mb-6">
      <CardHeader className="bg-navy-50">
        <CardTitle className="text-navy-800 flex items-center gap-2">
          <User className="w-5 h-5" />
          학생 정보
          {isDevelopmentMode() && (
            <Badge variant="secondary" className="ml-2 text-xs">개발 모드</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-navy-600">이름:</span>
            <span className="ml-2 text-navy-900">{grades?.personalInfo?.name || studentName || '미입력'}</span>
          </div>
          <div>
            <span className="text-navy-600">주소:</span>
            <span className="ml-2 text-navy-900">{grades?.personalInfo?.address || '미입력'}</span>
          </div>
          <div>
            <span className="text-navy-600">학교유형:</span>
            <span className="ml-2 text-navy-900">{grades?.personalInfo?.schoolType || '미입력'}</span>
          </div>
          <div>
            <span className="text-navy-600">계열:</span>
            <span className="ml-2 text-navy-900">{grades?.personalInfo?.trackType || '미입력'}</span>
          </div>
        </div>
        <div className="mt-4">
          <span className="text-navy-600">지망학과:</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {[grades?.personalInfo?.preferredMajor1, grades?.personalInfo?.preferredMajor2, grades?.personalInfo?.preferredMajor3]
              .filter(major => major && major.trim())
              .map((major, index) => (
                <Badge key={index} className="bg-gold-100 text-gold-800">
                  {major === '기타(직접입력)' ? grades?.personalInfo?.customMajor || '기타' : major}
                </Badge>
              ))}
          </div>
        </div>
        {isDevelopmentMode() && (
          <div className="mt-4 p-3 bg-navy-50 rounded border border-navy-200">
            <p className="text-xs text-navy-600">
              <strong>개발 모드:</strong> 현재 하드코딩된 목업 데이터를 사용 중입니다. 
              실제 배포 시에는 Supabase 데이터베이스의 실제 대학 데이터와 연동됩니다.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // 향상된 대학 카드 렌더링 함수
  const renderEnhancedUniversityCard = (university: DetailedUniversity, index: number) => {
    const colorClass = getAdmissionProbabilityColor(university.matchPercentage);
    const isExpanded = expandedAnalysis[`${university.name}-${index}`];
    
    return (
      <div key={`${university.name}-${index}`} className={`p-4 rounded-lg border-2 ${colorClass} text-white mb-4`}>
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold">{university.name}</h3>
              <p className="text-sm opacity-90">{university.department}</p>
              <p className="text-xs opacity-75">{university.location}</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{university.matchPercentage}%</div>
              <div className="text-xs">합격가능성</div>
            </div>
          </div>

          <div className="bg-white/20 rounded p-3 space-y-2">
            <div className="text-sm">
              <strong>반영비율:</strong> {university.reflectionRatio}
            </div>
            {university.admissionData && (
              <div className="space-y-1 text-xs">
                <div><strong>작년 데이터:</strong> {university.admissionData.lastYear.score}등급 / {university.admissionData.lastYear.students}명</div>
                <div className="opacity-75"><strong>3년 평균:</strong> {university.admissionData.threeYearAvg.score}등급 / {university.admissionData.threeYearAvg.students}명</div>
                <div className="opacity-75">
                  <strong>연도별:</strong> {university.admissionData.yearlyData.map(data => 
                    `${data.year}년 ${data.score}등급`
                  ).join(', ')}
                </div>
              </div>
            )}
          </div>

          <Collapsible>
            <CollapsibleTrigger 
              className="flex items-center justify-between w-full p-2 bg-white/20 rounded hover:bg-white/30 transition-colors"
              onClick={() => toggleAnalysis(`${university.name}-${index}`)}
            >
              <span className="text-sm font-medium">상세 분석</span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </CollapsibleTrigger>
            {isExpanded && (
              <CollapsibleContent className="bg-white/20 rounded p-3 mt-2 space-y-2 text-sm">
                <div>
                  <strong>전략:</strong> {university.admissionStrategy}
                </div>
                <div>
                  <strong>경쟁분석:</strong> {university.competitionAnalysis}
                </div>
                <div>
                  <strong>경쟁률:</strong> {university.competitionRate}:1
                </div>
              </CollapsibleContent>
            )}
          </Collapsible>
        </div>
      </div>
    );
  };

  // 로딩 상태 표시
  const renderLoadingState = () => (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-navy-600" />
        <p className="text-navy-600">
          {isDevelopmentMode() ? '목업 대학 데이터 로딩 중...' : '실제 대학 데이터를 분석 중입니다...'}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-navy-50 p-4" ref={reportRef}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Button onClick={onBack} variant="outline" className="mb-4 border-navy-300 text-navy-700 hover:bg-navy-100">
            ← 성적 입력으로 돌아가기
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl mb-2 text-navy-900">성적 분석 보고서</h1>
              <p className="text-navy-600">{studentName ? `${studentName}님의 ` : ''}맞춤형 입시 분석 결과입니다.</p>
            </div>
            {isDevelopmentMode() && (
              <Badge variant="outline" className="border-navy-300 text-navy-600">
                개발 모드 - 목업 데이터
              </Badge>
            )}
          </div>
        </div>

        {renderPersonalInfo()}

        {/* 성적 분석 요약 섹션 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* 내신 성적 분석 */}
          <Card className="shadow-lg border-navy-200">
            <CardHeader className="bg-navy-50">
              <CardTitle className="text-navy-800 flex items-center gap-2">
                <School className="w-5 h-5" />
                내신 과목별 성적분석
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-navy-50 rounded">
                  <span className="text-navy-700">평균 내신등급</span>
                  <span className="text-2xl font-bold text-navy-900">{schoolGPA || 0}등급</span>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-navy-800">유리한 반영비율</h4>
                  <p className="text-sm text-navy-600 bg-gold-50 p-2 rounded border border-gold-200">
                    {schoolBestRatio}
                  </p>
                </div>

                {schoolSubjectAverages.length > 0 && (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={schoolSubjectAverages}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 9]} />
                        <Tooltip />
                        <Bar dataKey="average" fill="#f59e0b" name="내 성적" />
                        <Bar dataKey="nationalAverage" fill="#94a3b8" name="전국평균" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 수능 성적 분석 */}
          <Card className="shadow-lg border-navy-200">
            <CardHeader className="bg-navy-50">
              <CardTitle className="text-navy-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                수능 과목별 성적분석
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-navy-50 rounded">
                  <span className="text-navy-700">평균 수능등급</span>
                  <span className="text-2xl font-bold text-navy-900">{suneungAverage || 0}등급</span>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-navy-800">유리한 반영비율</h4>
                  <p className="text-sm text-navy-600 bg-gold-50 p-2 rounded border border-gold-200">
                    {suneungBestRatio}
                  </p>
                </div>

                {suneungSubjectData.length > 0 && (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={suneungSubjectData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 9]} />
                        <Tooltip />
                        <Bar dataKey="grade" fill="#0f172a" name="등급" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 대학 추천 섹션 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="susi">수시 추천 대학</TabsTrigger>
            <TabsTrigger value="jungsi">정시 추천 대학</TabsTrigger>
          </TabsList>

          <TabsContent value="susi">
            <Card className="shadow-lg border-navy-200">
              <CardHeader className="bg-navy-50">
                <CardTitle className="text-navy-800 flex items-center justify-between">
                  <span>수시 추천 대학 (상위 20개)</span>
                  {isDevelopmentMode() && (
                    <Badge variant="secondary" className="text-xs">목업 데이터</Badge>
                  )}
                </CardTitle>
                <p className="text-navy-600 text-sm mt-2">
                  색상으로 합격 가능성을 표시합니다: 
                  <span className="inline-block w-3 h-3 bg-green-600 rounded ml-2 mr-1"></span>80%+ 
                  <span className="inline-block w-3 h-3 bg-green-300 rounded ml-2 mr-1"></span>50-79% 
                  <span className="inline-block w-3 h-3 bg-yellow-400 rounded ml-2 mr-1"></span>20-49% 
                  <span className="inline-block w-3 h-3 bg-red-500 rounded ml-2 mr-1"></span>20%미만
                </p>
              </CardHeader>
              <CardContent className="pt-6">
                {isLoadingUniversities ? (
                  renderLoadingState()
                ) : (
                  <div className="space-y-4">
                    {susiUniversities.length > 0 ? (
                      susiUniversities.map((university, index) => renderEnhancedUniversityCard(university, index))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-navy-600">추천할 수시 대학이 없습니다.</p>
                        <p className="text-sm text-navy-500 mt-2">성적을 입력하거나 시스템 관리자에게 문의하세요.</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jungsi">
            <Tabs value={activeJungsiTab} onValueChange={setActiveJungsiTab}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="ga">가군</TabsTrigger>
                <TabsTrigger value="na">나군</TabsTrigger>
                <TabsTrigger value="da">다군</TabsTrigger>
              </TabsList>

              {(['ga', 'na', 'da'] as const).map((tab) => (
                <TabsContent key={tab} value={tab}>
                  <Card className="shadow-lg border-navy-200">
                    <CardHeader className="bg-navy-50">
                      <CardTitle className="text-navy-800 flex items-center justify-between">
                        <span>정시 {tab === 'ga' ? '가' : tab === 'na' ? '나' : '다'}군 추천 대학</span>
                        {isDevelopmentMode() && (
                          <Badge variant="secondary" className="text-xs">목업 데이터</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {isLoadingUniversities ? (
                        renderLoadingState()
                      ) : (
                        <div className="space-y-4">
                          {jungsiUniversities[tab].length > 0 ? (
                            jungsiUniversities[tab].map((university, index) => renderEnhancedUniversityCard(university, index))
                          ) : (
                            <div className="text-center py-8">
                              <p className="text-navy-600">
                                {tab === 'ga' ? '가' : tab === 'na' ? '나' : '다'}군 추천 대학이 없습니다.
                              </p>
                              <p className="text-sm text-navy-500 mt-2">
                                {isDevelopmentMode() ? '개발 모드에서는 제한된 데이터를 제공합니다.' : '성적을 입력하거나 시스템 관리자에게 문의하세요.'}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}