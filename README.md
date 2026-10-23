# 커리어 시그널

구글 시트의 채용 정보를 직접 읽는 개인 채용 대시보드입니다. GitHub Pages에서 서버나 API 키 없이 동작합니다.

- 원본: [지원 후보 리스트](https://docs.google.com/spreadsheets/d/1bFrrWXkjdT-nU1Zqj-Hy_Hoqe6LDtub8__FX7T_Z-vQ/edit)
- 접속 즉시, 열려 있는 동안 60초마다, 탭으로 돌아올 때 원본 XLSX를 다시 가져옵니다.
- 숨겨진 HYPERLINK 수식의 실제 지원 링크까지 읽습니다. API 키·계정 토큰은 사이트에 포함하지 않습니다.
- 검색, 직무 분야, 마감순 정렬, 7일 이내 마감, 관심·지원 관리, 모바일 화면을 지원합니다.
- 마감일은 한국 시간(Asia/Seoul) 기준입니다. 날짜가 없는 상시 채용은 모집 중에 포함됩니다.
- 시트의 관심·지원 여부를 기본값으로 사용합니다. 사이트에서 바꾼 값은 **현재 브라우저에만 저장**되며 원본 시트를 수정하지 않습니다. 브라우저 데이터를 지우면 개인 표시도 지워집니다.
- 통신 실패 시 마지막 성공 자료와 확인 시각을 표시하고 재시도합니다. ‘최근 확인’은 수집 성공 시각이며 시트의 마지막 수정 시각이 아닙니다.

## 실행 및 검증

Node.js 22 이상에서 별도 설치 없이 실행합니다.

```sh
node scripts/serve.mjs
node --test tests/*.test.mjs
```

`http://127.0.0.1:4173`에 접속합니다. Chrome, Edge, Safari, Firefox의 최신 버전을 권장합니다 (`DecompressionStream('deflate-raw')` 필요).

## GitHub Pages

정적 파일은 `dist/`에 있습니다. 저장소의 Settings → Pages → Source를 **GitHub Actions**로 설정합니다. `main` 브랜치에 코드를 푸시하면 `.github/workflows/pages.yml`이 검증 후 배포합니다. 별도 예약 빌드는 필요 없습니다. 사이트를 방문하는 브라우저가 매번 시트를 직접 조회하므로 시트 갱신은 사이트 재배포 없이 반영됩니다.

데이터 연결은 `dist/model.js`의 `SHEET_ID`, 탭 이름은 `dist/xlsx.js`의 `sheetName`으로 설정합니다. 원본 시트의 현재 공개 읽기 권한이 유지되어야 합니다. 공개 사이트에서 접근 가능한 자료이므로 개인적인 정보는 원본 시트에 추가하지 않는 방식으로 운영하세요. Google 내보내기 캐시 또는 장애로 인해 반영이 늦어질 수 있어 즉시 반영을 보장하지는 않습니다.

필수 헤더: `기업명`, `직무`. 지원 헤더: `지원 여부`, `관심 공고`, `요구 기술`, `연봉`, `매출액`, `직원수`, `모집 마감일`, `공고 링크`. 열 순서를 바꾸거나 행을 추가해도 이름으로 연결합니다.

기술 참고: [Google Sheets 데이터 접근](https://developers.google.com/chart/interactive/docs/spreadsheets), [GitHub Pages 게시 소스](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
