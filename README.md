# NEUROSCREEN — Pre-Screening Platform for Early Learning Handwriting

NeuroScreen is an observational early learning pre-screening platform for children under 10 years old. It supports **Parent** and **Teacher** roles, collects individual character-level and sentence-level handwriting stroke samples in a dedicated child-friendly screening UI, stores them in MongoDB, and exposes a pluggable ML abstraction layer for future FastAPI model services without fake predictions.

---

## Technical Stack

- **Backend**: Node.js, Express.js, JavaScript (CommonJS), MongoDB, Mongoose, Multer, XLSX, Jest, Supertest.
- **Mobile**: React Native, Expo, JavaScript, React Navigation, SVG Canvas, Axios.
- **Database**: MongoDB Atlas / Mongoose ORM.
- **Testing**: Jest, Supertest (22 Automated Tests Passed, 100% Success).

---

## Architectural Principles

1. **No Fake ML Predictions**: Current system uses `DisabledModelProvider` returning `ANALYSIS_PENDING` and `MODEL_SERVICE_NOT_CONNECTED`. No PyTorch models are downloaded or hardcoded with fake predictions.
2. **Strict Non-Diagnostic Positioning**: Never claims to diagnose dyslexia, dysgraphia, or any medical condition. Uses neutral terms (`Within expected range`, `Requires attention`, `Observational pre-screening`).
3. **Role-Based Security & IDOR Protection**: Enforces JWT verification, parent child-ownership checks, and teacher school/class authorization.
4. **12-Step Excel Import Engine**: Validates file types, column headers, duplicate roll numbers (in-file & in-database), phone number formats, and presents interactive error preview before committing import. Automatic parent-student linkage matching parent phone number.

---

## Directory Structure

```
FINAL_YEAR_PROJECT/
├── backend/
│   ├── package.json
│   ├── jest.config.js
│   ├── .env
│   ├── .env.example
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/ (db.js, jwt.js, storage.js)
│   │   ├── models/ (User.js, Student.js, Screening.js, ScreeningResult.js, etc.)
│   │   ├── middleware/ (authMiddleware.js, rbacMiddleware.js, ownershipMiddleware.js, uploadMiddleware.js, errorHandler.js)
│   │   ├── controllers/ (authController.js, parentController.js, teacherController.js, screeningController.js, reportController.js)
│   │   ├── routes/ (authRoutes.js, parentRoutes.js, teacherRoutes.js, screeningRoutes.js, reportRoutes.js)
│   │   ├── services/ (excelService.js, exportService.js, screeningService.js)
│   │   ├── ml/ (ModelProvider.js, DisabledModelProvider.js)
│   │   └── docs/ (API_DOCUMENTATION.md, FASTAPI_ML_CONTRACT.md)
│   └── tests/ (auth.test.js, parent.test.js, teacher.test.js, excel-import.test.js, screening.test.js, security.test.js)
├── mobile/
│   ├── package.json
│   ├── app.json
│   ├── index.js
│   ├── App.js
│   └── src/
│       ├── api/ (client.js)
│       ├── context/ (AuthContext.js)
│       ├── theme/ (colors.js)
│       ├── components/ (HandwritingCanvas.js, DisclaimerBanner.js, StatusBadge.js)
│       ├── screens/
│       │   ├── auth/ (RoleSelectScreen.js, ParentLoginScreen.js, OTPVerifyScreen.js, TeacherLoginScreen.js)
│       │   ├── parent/ (ParentHomeScreen.js, ConsentScreen.js, AddChildScreen.js, ParentReportScreen.js)
│       │   ├── teacher/ (TeacherDashboardScreen.js, ClassSetupScreen.js, ExcelImportScreen.js)
│       │   └── child/ (ChildIntroScreen.js, CharacterScreeningScreen.js, SentenceScreeningScreen.js, ScreeningCompleteScreen.js)
│       └── navigation/ (RootNavigator.js)
└── README.md
```

---

## Running the Backend & Tests

### 1. Install & Start Backend
```bash
cd backend
npm install
npm start
```
The Express server will start on `http://localhost:5000`.

### 2. Run Automated Test Suite
```bash
cd backend
npm test
```

### Test Results Summary:
- **Test Suites**: 5 passed, 5 total
- **Tests**: 22 passed, 22 total
- **Coverage**: Auth, Parent, Teacher, Excel Import (12-step validation), Screening stroke collection, Model Abstraction, IDOR Security, and Reports.

---

## Future FastAPI ML Microservice Integration

When PyTorch models are trained, update the Node.js ML provider to point to FastAPI:

```javascript
// Example future provider call in backend/src/ml/FastAPIModelProvider.js
const axios = require('axios');

class FastAPIModelProvider extends ModelProvider {
  async predictCharacter(sampleData) {
    const res = await axios.post('http://fastapi-ml-service:8000/model/character/predict', sampleData);
    return res.data;
  }
}
```

See [FASTAPI_ML_CONTRACT.md](file:///home/tharunkumar/Desktop/FINAL_YEAR_PROJECT/backend/src/docs/FASTAPI_ML_CONTRACT.md) for full schema specifications.
