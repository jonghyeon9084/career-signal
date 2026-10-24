# 커리어 시그널

구글 시트의 채용 정보를 직접 읽고 관심·지원 상태를 저장하는 개인 채용 대시보드입니다. GitHub Pages에서 실행되며 쓰기는 Google 로그인과 파일 선택을 통해 사용자가 허용한 시트에만 접근합니다.

- 원본: [지원 후보 리스트](https://docs.google.com/spreadsheets/d/1bFrrWXkjdT-nU1Zqj-Hy_Hoqe6LDtub8__FX7T_Z-vQ/edit)
- 접속 즉시, 열려 있는 동안 60초마다, 탭으로 돌아올 때 원본 XLSX를 다시 가져옵니다.
- 숨겨진 HYPERLINK 수식의 실제 지원 링크까지 읽습니다. API 키·계정 토큰·클라이언트 비밀키는 배포 파일에 포함하지 않습니다. 공개 식별자인 OAuth 클라이언트 ID만 설정합니다.
- 검색, 직무 분야, 마감순·기업 규모순·연봉순 정렬, 7일 이내 마감, 관심·지원 관리, 모바일 화면을 지원합니다. 기업 규모는 직원 수, 연봉 범위는 하한액으로 비교하고 월급은 12개월로 환산합니다. 미확인 값은 양방향 정렬 모두 마지막에 표시합니다.
- 마감일은 한국 시간(Asia/Seoul) 기준입니다. 날짜가 없는 상시 채용은 모집 중에 포함됩니다.
- 시트의 관심·지원 여부를 모든 기기의 기준으로 사용합니다. **Google 연결 → 지원 후보 리스트 선택** 후 변경하면 해당 체크박스 셀에 즉시 저장합니다. 연결된 페이지는 15초마다, 읽기 전용 페이지는 60초마다 다시 조회합니다. 탭으로 돌아올 때도 조회합니다.
- 저장 직전 최신 행과 열을 다시 찾고, 해당 필드의 불리언 값 한 개만 씁니다. 저장 실패·권한 거부·중복 공고는 성공으로 표시하지 않습니다. 이전 버전의 브라우저 전용 표시는 시트보다 우선하지 않으며 연결 창에서 JSON 백업할 수 있습니다.
- Google 접근 토큰은 현재 페이지 메모리에만 보관합니다. 페이지를 새로 열거나 토큰이 만료된 뒤 수정하려면 다시 Google 연결이 필요합니다. 시트에 이미 저장한 상태는 유지됩니다.
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

## Google 쓰기 연결

`dist/sync-config.js`에는 **공개 OAuth 클라이언트 ID만** 지정합니다. API 키는 사용하지 않으며, 접근 토큰이나 클라이언트 비밀키를 저장소에 넣지 않습니다. `drive.file` 범위만 요청하며 사용자가 승인한 채용 시트의 관심·지원 셀만 변경합니다.

Google Cloud 프로젝트 `civic-wall-512515-m1`에서 Google Sheets API, Google Drive API, Google Picker API를 사용 설정합니다. OAuth 승인 출처는 `https://jonghyeon9084.github.io`, 승인된 리디렉션 URI는 `https://jonghyeon9084.github.io/career-signal/file-access.html`입니다. 개발 시 별도의 개발 출처와 리디렉션 URI도 등록해야 합니다. 개인용 OAuth 앱은 사용자 계정만 테스트 사용자로 지정합니다. 결제 계정이나 유료 컴퓨팅 리소스는 필요하지 않습니다.

다른 기기에서 같은 Google 계정으로 연결하면 됩니다. 이미 앱에 허용한 시트는 Drive API의 `isAppAuthorized` 및 `canEdit`으로 확인하여 파일 선택을 생략합니다. 최초 허용이 필요하면 **Google 화면에서 파일 선택**을 눌러 지원 후보 리스트를 선택합니다. Google이 호스팅하는 `trigger_onepick` 경로를 사용하므로 브라우저에 개발자 API 키를 전달하지 않습니다.

파일 선택 경로는 파일 접근 허용에만 사용합니다. 반환된 일회용 코드는 교환하거나 저장하지 않고 URL에서 즉시 제거합니다. 연결 성공 여부는 메모리의 GIS 접근 토큰으로 Drive API의 파일 ID·앱 허용 여부·수정 권한과 Sheets API 읽기를 모두 확인하여 판단합니다. 선택 후 기존 토큰이 거부되면 연결을 해제하고 같은 계정으로 다시 로그인하도록 안내합니다. 복귀 알림은 무작위 state로 연결하며, 접근 토큰은 URL이나 브라우저 저장소에 넣지 않습니다.

Google 로그인을 하지 않은 방문자에게 쓰기 권한을 제공하지 않습니다. Google Sheets는 셀에 대한 원자적인 비교 후 쓰기 API를 제공하지 않으므로 외부 행 정렬·삭제와 저장을 동시에 수행하지 않는 것이 좋습니다. 앱은 저장 직전에 현재 행을 재조회합니다.

배포 전 테스트는 기능 회귀와 함께 `dist/`의 알려진 비밀키 형식 및 API 키 기반 파일 선택 의존성을 검사합니다. 검출되면 GitHub Actions 배포를 중단합니다. 이전 커밋의 키는 코드 삭제만으로 폐기되지 않으므로 Google Cloud에서 해당 키를 삭제해야 합니다. 보안 경고는 실제 폐기 확인 후 `revoked`로 해결 처리합니다.

필수 헤더: `기업명`, `직무`. 지원 헤더: `지원 여부`, `관심 공고`, `요구 기술`, `연봉`, `매출액`, `직원수`, `모집 마감일`, `공고 링크`. 열 순서를 바꾸거나 행을 추가해도 이름으로 연결합니다.

기술 참고: [Google 로그인 토큰 모델](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [파일별 접근 범위](https://developers.google.com/workspace/sheets/api/scopes), [Google 호스팅 파일 선택](https://developers.google.com/workspace/drive/picker/guides/desktop-mobile-picker), [GitHub Pages 게시 소스](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
