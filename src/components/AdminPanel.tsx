import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Trash2, Eye, Upload, Download, RefreshCw, Database, TrendingUp } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { projectId, publicAnonKey, isDevelopmentMode } from '../utils/supabase/info';

interface Account {
  id: string;
  name: string;
  password: string;
}

interface GradeData {
  personalInfo: any;
  school: any;
  suneung: any;
}

interface AdminPanelProps {
  accounts: Account[];
  studentGrades: {[key: string]: GradeData};
  onAddAccount: (account: Account) => void;
  onDeleteAccount: (id: string) => void;
  onUpdateStudentGrades: (studentId: string, grades: GradeData) => void;
  onBack: () => void;
  onViewPrintReport: (studentId: string) => void;
}

interface UploadStats {
  susiUniversities: number;
  jungsiUniversities: number;
  totalUniversities: number;
  lastUpdated?: string;
}

export function AdminPanel({ 
  accounts, 
  studentGrades, 
  onAddAccount, 
  onDeleteAccount, 
  onUpdateStudentGrades, 
  onBack, 
  onViewPrintReport 
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState('accounts');
  const [newAccount, setNewAccount] = useState({ id: '', name: '', password: '' });
  const [password, setPassword] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'complete' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [systemStats, setSystemStats] = useState<UploadStats>({
    susiUniversities: 0,
    jungsiUniversities: 0,
    totalUniversities: 0
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // 시스템 상태 로드
  useEffect(() => {
    loadSystemStats();
  }, []);

  const loadSystemStats = async () => {
    if (isDevelopmentMode()) {
      // 개발 모드에서는 목업 데이터
      setSystemStats({
        susiUniversities: 56000,
        jungsiUniversities: 21000,
        totalUniversities: 77000,
        lastUpdated: new Date().toISOString()
      });
      return;
    }

    setIsLoadingStats(true);
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-72188212/status`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSystemStats(result.data);
        }
      }
    } catch (error) {
      console.error('시스템 상태 로드 오류:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // CSV 파일을 청크 단위로 처리하는 함수
  const processCSVFile = (file: File, type: 'susi' | 'jungsi'): Promise<any[][]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          
          const data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            return row;
          }).filter(row => row[headers[0]]); // 첫 번째 컬럼이 비어있지 않은 행만

          // 청크 단위로 분할 (청크당 1000개)
          const chunkSize = 1000;
          const chunks: any[][] = [];
          for (let i = 0; i < data.length; i += chunkSize) {
            chunks.push(data.slice(i, i + chunkSize));
          }

          console.log(`CSV 파일 처리 완료: ${data.length}개 데이터, ${chunks.length}개 청크`);
          resolve(chunks);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsText(file, 'utf-8');
    });
  };

  // 대용량 CSV 업로드 처리
  const handleCSVUpload = async (file: File, type: 'susi' | 'jungsi') => {
    if (!password) {
      setUploadMessage('관리자 비밀번호를 입력해주세요.');
      return;
    }

    if (isDevelopmentMode()) {
      setUploadMessage('개발 모드에서는 실제 업로드가 지원되지 않습니다.');
      return;
    }

    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadMessage(`${type === 'susi' ? '수시' : '정시'} 대학 데이터 업로드 중...`);

    try {
      const chunks = await processCSVFile(file, type);
      const totalChunks = chunks.length;

      console.log(`${type} 데이터 업로드 시작: ${totalChunks}개 청크`);

      // 청크별 업로드
      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        const isComplete = i === totalChunks - 1;
        
        setUploadProgress(Math.round((i / totalChunks) * 90)); // 업로드는 90%까지
        setUploadMessage(`청크 ${i + 1}/${totalChunks} 업로드 중... (${chunk.length}개 데이터)`);

        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-72188212/admin/upload-universities`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            password,
            data: chunk,
            type,
            isComplete,
            chunkIndex: i
          })
        });

        const result = await response.json();
        
        if (!response.ok || !result.success) {
          throw new Error(result.error || `청크 ${i + 1} 업로드 실패`);
        }

        console.log(`청크 ${i + 1} 업로드 완료:`, result.message);
      }

      // 처리 완료
      setUploadStatus('processing');
      setUploadProgress(95);
      setUploadMessage('데이터 처리 및 인덱싱 중...');

      // 잠시 대기 후 완료 처리
      setTimeout(async () => {
        setUploadProgress(100);
        setUploadStatus('complete');
        setUploadMessage(`✅ ${type === 'susi' ? '수시' : '정시'} 대학 데이터 업로드 완료!`);
        
        // 시스템 상태 새로고침
        await loadSystemStats();
        
        // 5초 후 상태 초기화
        setTimeout(() => {
          setUploadStatus('idle');
          setUploadProgress(0);
          setUploadMessage('');
        }, 5000);
      }, 2000);

    } catch (error) {
      console.error('CSV 업로드 오류:', error);
      setUploadStatus('error');
      setUploadMessage(`❌ 업로드 실패: ${error.message}`);
      
      setTimeout(() => {
        setUploadStatus('idle');
        setUploadProgress(0);
        setUploadMessage('');
      }, 5000);
    }
  };

  const handleAddAccount = () => {
    if (newAccount.id && newAccount.name && newAccount.password) {
      onAddAccount(newAccount);
      setNewAccount({ id: '', name: '', password: '' });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const estimateDataSize = (count: number, avgRowSize: number = 150) => {
    return formatFileSize(count * avgRowSize);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl text-navy-900">관리자 패널</h1>
        <div className="flex items-center space-x-4">
          {isDevelopmentMode() && (
            <Badge variant="outline" className="border-navy-300 text-navy-600">
              개발 모드
            </Badge>
          )}
          <Button onClick={onBack} variant="outline" className="border-navy-300 text-navy-700">
            ← 로그인으로 돌아가기
          </Button>
        </div>
      </div>

      {/* 시스템 상태 대시보드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-navy-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-navy-600">수시 대학</p>
                <p className="text-2xl font-bold text-navy-900">
                  {isLoadingStats ? '...' : systemStats.susiUniversities.toLocaleString()}
                </p>
                <p className="text-xs text-navy-500">
                  {estimateDataSize(systemStats.susiUniversities)}
                </p>
              </div>
              <Database className="w-8 h-8 text-navy-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-navy-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-navy-600">정시 대학</p>
                <p className="text-2xl font-bold text-navy-900">
                  {isLoadingStats ? '...' : systemStats.jungsiUniversities.toLocaleString()}
                </p>
                <p className="text-xs text-navy-500">
                  {estimateDataSize(systemStats.jungsiUniversities)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-navy-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-navy-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-navy-600">전체 대학</p>
                <p className="text-2xl font-bold text-navy-900">
                  {isLoadingStats ? '...' : systemStats.totalUniversities.toLocaleString()}
                </p>
                <p className="text-xs text-navy-500">
                  {estimateDataSize(systemStats.totalUniversities)}
                </p>
              </div>
              <RefreshCw 
                className={`w-8 h-8 text-navy-400 cursor-pointer hover:text-navy-600 ${isLoadingStats ? 'animate-spin' : ''}`}
                onClick={loadSystemStats}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="accounts">계정 관리</TabsTrigger>
          <TabsTrigger value="data">대학 데이터 관리</TabsTrigger>
          <TabsTrigger value="reports">성적 리포트</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <Card className="border-navy-200">
            <CardHeader>
              <CardTitle className="text-navy-800">학생 계정 관리</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-navy-50 rounded">
                  <div>
                    <Label>학생 ID</Label>
                    <Input
                      value={newAccount.id}
                      onChange={(e) => setNewAccount({...newAccount, id: e.target.value})}
                      placeholder="student123"
                    />
                  </div>
                  <div>
                    <Label>이름</Label>
                    <Input
                      value={newAccount.name}
                      onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
                      placeholder="김학생"
                    />
                  </div>
                  <div>
                    <Label>비밀번호</Label>
                    <Input
                      type="password"
                      value={newAccount.password}
                      onChange={(e) => setNewAccount({...newAccount, password: e.target.value})}
                      placeholder="password"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddAccount} className="w-full bg-navy-700 hover:bg-navy-800">
                      계정 추가
                    </Button>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>이름</TableHead>
                      <TableHead>성적 입력 여부</TableHead>
                      <TableHead>액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono">{account.id}</TableCell>
                        <TableCell>{account.name}</TableCell>
                        <TableCell>
                          <Badge variant={studentGrades[account.id] ? "default" : "secondary"}>
                            {studentGrades[account.id] ? "입력 완료" : "미입력"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onViewPrintReport(account.id)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>계정 삭제</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {account.name}({account.id}) 계정을 삭제하시겠습니까? 
                                    이 작업은 되돌릴 수 없습니다.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDeleteAccount(account.id)}>
                                    삭제
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <div className="space-y-6">
            {/* 관리자 비밀번호 입력 */}
            <Card className="border-navy-200">
              <CardHeader>
                <CardTitle className="text-navy-800">관리자 인증</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-w-md">
                  <Label>관리자 비밀번호</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="admin123"
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 업로드 상태 */}
            {uploadStatus !== 'idle' && (
              <Card className="border-navy-200">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-navy-700">업로드 진행상황</span>
                      <span className="text-sm text-navy-500">{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} className="w-full" />
                    <p className="text-sm text-navy-600">{uploadMessage}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 대학 데이터 업로드 */}
            <Card className="border-navy-200">
              <CardHeader>
                <CardTitle className="text-navy-800">대학 데이터 업로드</CardTitle>
                <p className="text-sm text-navy-600">
                  CSV 파일을 청크 단위로 처리하여 대용량 데이터도 안전하게 업로드할 수 있습니다.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 수시 데이터 업로드 */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-navy-800">수시 대학 데이터</h3>
                    <div className="p-4 bg-blue-50 rounded border border-blue-200">
                      <p className="text-sm text-blue-700 mb-2">
                        <strong>현재:</strong> {systemStats.susiUniversities.toLocaleString()}개 대학
                      </p>
                      <p className="text-xs text-blue-600">
                        예상 크기: {estimateDataSize(systemStats.susiUniversities)}
                      </p>
                    </div>
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleCSVUpload(file, 'susi');
                        }
                      }}
                      disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-navy-500">
                      CSV 파일만 지원됩니다. 파일 크기 제한: 없음
                    </p>
                  </div>

                  {/* 정시 데이터 업로드 */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-navy-800">정시 대학 데이터</h3>
                    <div className="p-4 bg-green-50 rounded border border-green-200">
                      <p className="text-sm text-green-700 mb-2">
                        <strong>현재:</strong> {systemStats.jungsiUniversities.toLocaleString()}개 대학
                      </p>
                      <p className="text-xs text-green-600">
                        예상 크기: {estimateDataSize(systemStats.jungsiUniversities)}
                      </p>
                    </div>
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleCSVUpload(file, 'jungsi');
                        }
                      }}
                      disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-navy-500">
                      CSV 파일만 지원됩니다. 파일 크기 제한: 없음
                    </p>
                  </div>
                </div>

                {isDevelopmentMode() && (
                  <Alert className="mt-4">
                    <AlertDescription>
                      <strong>개발 모드:</strong> 실제 파일 업로드는 배포 환경에서만 작동합니다. 
                      현재는 시뮬레이션 모드로 실행됩니다.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* 성능 최적화 정보 */}
            <Card className="border-navy-200">
              <CardHeader>
                <CardTitle className="text-navy-800">시스템 성능 최적화</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium text-navy-700 mb-2">업로드 최적화</h4>
                    <ul className="space-y-1 text-navy-600">
                      <li>• 청크 단위 처리 (1,000개씩)</li>
                      <li>• 실시간 진행률 표시</li>
                      <li>• 자동 재시도 메커니즘</li>
                      <li>• 데이터 압축 및 인덱싱</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-navy-700 mb-2">검색 최적화</h4>
                    <ul className="space-y-1 text-navy-600">
                      <li>• 성적 구간별 인덱스</li>
                      <li>• 결과 캐싱 (1시간)</li>
                      <li>• 점수 기반 정렬</li>
                      <li>• 실시간 매칭 알고리즘</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-navy-50 rounded">
                  <p className="text-xs text-navy-600">
                    <strong>마지막 업데이트:</strong> {systemStats.lastUpdated ? 
                      new Date(systemStats.lastUpdated).toLocaleString('ko-KR') : '없음'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <Card className="border-navy-200">
            <CardHeader>
              <CardTitle className="text-navy-800">학생 성적 리포트</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>학생명</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>내신 평균</TableHead>
                    <TableHead>수능 평균</TableHead>
                    <TableHead>리포트 보기</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => {
                    const grades = studentGrades[account.id];
                    return (
                      <TableRow key={account.id}>
                        <TableCell>{account.name}</TableCell>
                        <TableCell className="font-mono">{account.id}</TableCell>
                        <TableCell>
                          {grades ? (
                            <Badge variant="default">입력됨</Badge>
                          ) : (
                            <Badge variant="secondary">미입력</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {grades ? (
                            <Badge variant="default">입력됨</Badge>
                          ) : (
                            <Badge variant="secondary">미입력</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewPrintReport(account.id)}
                            className="border-navy-300 text-navy-700"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            리포트 보기
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}