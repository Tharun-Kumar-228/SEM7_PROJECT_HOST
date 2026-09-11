# NEUROSCREEN — REST API Documentation

## Authentication Endpoints (`/api/auth`)

### 1. Send Parent OTP
- **`POST /api/auth/send-otp`**
- **Body**: `{ "phone": "+1234567890" }`
- **Response**: `{ "success": true, "message": "OTP sent successfully" }`

### 2. Verify Parent OTP
- **`POST /api/auth/verify-otp`**
- **Body**: `{ "phone": "+1234567890", "otpCode": "123456", "parentName": "Jane Doe" }`
- **Response**: `{ "success": true, "data": { "token": "JWT...", "user": { ... } } }`

### 3. Teacher Register & Login
- **`POST /api/auth/teacher/register`**
- **Body**: `{ "name": "Teacher Smith", "email": "teacher@school.org", "password": "securepassword" }`
- **`POST /api/auth/teacher/login`**
- **Body**: `{ "email": "teacher@school.org", "password": "securepassword" }`

---

## Parent Endpoints (`/api/parents`) — Header: `Authorization: Bearer <Token>`

- **`POST /api/parents/children`**: Add child profile `{ "name": "Leo", "age": 6, "grade": "Grade 1" }`
- **`GET /api/parents/children`**: List parent's linked children.
- **`POST /api/parents/consent`**: Record explicit screening consent `{ "studentId": "...", "consentGiven": true }`

---

## Teacher Endpoints (`/api/teachers`) — Header: `Authorization: Bearer <Token>`

- **`POST /api/teachers/schools`**: Setup school `{ "name": "Greenwood Elementary", "code": "GW101" }`
- **`POST /api/teachers/classes`**: Setup class `{ "schoolId": "...", "grade": "1", "section": "A" }`
- **`GET /api/teachers/classes`**: Fetch teacher's assigned classes.
- **`POST /api/teachers/students/excel-validate`**: Upload `.xlsx` file for 12-step validation preview.
- **`POST /api/teachers/students/excel-import`**: Confirm import of validated student records.
- **`GET /api/teachers/students`**: Search & filter student roster.

---

## Screening Endpoints (`/api/screenings`) — Header: `Authorization: Bearer <Token>`

- **`POST /api/screenings`**: Initiate screening session `{ "studentId": "..." }`
- **`POST /api/screenings/:id/character-samples`**: Upload single letter/number stroke image.
- **`POST /api/screenings/:id/sentence-sample`**: Upload sentence stroke image.
- **`POST /api/screenings/:id/analyze`**: Trigger ML service provider analysis (Returns `ANALYSIS_PENDING`).
- **`GET /api/screenings/:id/result`**: Retrieve screening session status & observational result.

---

## Reports & Export Endpoints (`/api/reports`)

- **`GET /api/reports/student/:id`**: Student pre-screening report & history with medical disclaimer.
- **`GET /api/reports/class/:id`**: Class aggregate screening summary.
- **`GET /api/reports/class/:id/export`**: Download Excel `.xlsx` class screening report.
