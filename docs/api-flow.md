# API Flows Documentation

## Tổng quan

Tài liệu này mô tả các API flows được sử dụng trong ứng dụng Train Game. Tất cả các API calls đều yêu cầu authentication token được lấy từ mobile app qua WebView message.

---

## 1. Authentication Flow

### 1.1 Token Management

**Token được nhận từ Mobile App:**
- Mobile app gửi token qua WebView message với format:
  ```json
  {
    "type": "AUTH_TOKEN" hoặc "TOKEN",
    "token": "bearer_token_string"
  }
  ```

**Token Storage:**
- Token được lưu trong `localStorage` với key `authToken`
- Token được quản lý bởi `TokenManager` singleton instance
- Token được tự động attach vào tất cả API requests với header: `Authorization: Bearer {token}`

**Token Flow:**
```
Mobile App → WebView Message → TokenManager.setupListeners() 
→ localStorage.setItem("authToken", token) 
→ tokenManager.getToken() → API Headers
```

---

## 2. API Endpoints

### 2.1 Base Configuration

- **Base URL**: Được lấy từ environment variable `VITE_API_URL`
- **API Version**: `/api/v1`
- **Content-Type**: `application/json`
- **Authentication**: Bearer token trong header `Authorization`

---

## 3. API Flows Chi Tiết

### 3.1 Fetch Game List

**Endpoint:** `GET /api/v1/game/list-game`

**Mục đích:** Lấy danh sách các game có sẵn để hiển thị trên menu chính.

**Function:** `fetchGameList()`

**Location:** `src/services/api.js:7-39`

**Request:**
```http
GET {API_URL}/api/v1/game/list-game
Headers:
  Content-Type: application/json
  Authorization: Bearer {token}
```

**Response Format:**
```json
{
  "success": true,
  "message": "...",
  "data": [
    {
      "name": "Game Name",
      "code": "game_code",
      "is_accessible": true/false
    }
  ]
}
```

**Usage Flow:**
1. User mở MenuScene
2. `MenuScene.loadGameButtons()` được gọi
3. `fetchGameList()` được gọi
4. Response data được map thành game buttons
5. Buttons được render trên màn hình

**Error Handling:**
- Nếu không có token → throw `Error("No token available")`
- Nếu HTTP error → throw `Error("HTTP error! status: {status}")`
- Nếu `success: false` hoặc không có `data` → return `[]`
- Catch error → log và throw lại

**Used In:**
- `src/scenes/MenuScene.js:163`

---

### 3.2 Start Game Session

**Endpoint:** `POST /api/v1/game/start-game`

**Mục đích:** Khởi tạo một game session mới, lấy questions và game configuration.

**Function:** `startGameSession(gameCode)`

**Location:** `src/services/api.js:41-76`

**Request:**
```http
POST {API_URL}/api/v1/game/start-game
Headers:
  Content-Type: application/json
  Authorization: Bearer {token}
Body:
{
  "game_code": "game_code_string" // default: "goody_bag" nếu không truyền
}
```

**Response Format:**
```json
{
  "success": true,
  "message": "...",
  "data": {
    "game_id": "session_id",
    "game_session_questions": [
      {
        "question": {
          "content": "Question text",
          "options": [
            {
              "text": "Option text",
              "is_correct": true/false
            }
          ]
        }
      }
    ],
    "game": {
      "time_limit": 180
    }
  }
}
```

**Usage Flow:**
1. User chọn game từ menu → navigate đến `{Game}MenuScene`
2. Trong `create()` method của MenuScene:
   - Gọi `startGameSession(gameCode)`
   - Lưu `game_id` để dùng khi end session
   - Lưu `game_session_questions` để render questions
   - Lưu `time_limit` để set timer
3. User click "Start" → navigate đến MainScene với questions đã load

**Error Handling:**
- Nếu không có token → throw `Error("No token available")`
- Nếu HTTP error → throw `Error("HTTP error! status: {status}")`
- Nếu `success: false` hoặc không có `data` → return `[]`
- Catch error → log và continue với default questions (fallback)

**Used In:**
- `src/scenes/GrammarTower/GrammarTowerMenuScene.js:43`
- `src/scenes/GrammarGoodyBag/GrammarGoodyBagMenuScene.js:51`
- `src/scenes/VocabularyRace/VocabularyRaceMenuScene.js:23`
- `src/scenes/trainsCars/TrainCarsMenuScene.js:20`

**Game Codes:**
- `grammar_tower`
- `goody_bag` (Grammar Goody Bag)
- `vocab_race` (Vocabulary Race)
- `trains_cars` (Train Cars)

---

### 3.3 End Game Session

**Endpoint:** `POST /api/v1/game/answer-batching`

**Mục đích:** Kết thúc game session và submit score của user.

**Function:** `endGameSession(gameId, score)`

**Location:** `src/services/api.js:78-113`

**Request:**
```http
POST {API_URL}/api/v1/game/answer-batching
Headers:
  Content-Type: application/json
  Authorization: Bearer {token}
Body:
{
  "game_id": "session_id_from_start_game",
  "score": 123
}
```

**Response Format:**
```json
{
  "success": true,
  "message": "...",
  "data": {
    // Response data structure
  }
}
```

**Usage Flow:**
1. User hoàn thành game → navigate đến `{Game}GameOverScene`
2. Trong `init(data)` của GameOverScene:
   - Nhận `gameId` và `points` từ previous scene
3. Trong `create()` method:
   - Gọi `endGameSession(gameId, score)`
   - Hiển thị score và game over UI
4. User có thể restart game

**Error Handling:**
- Nếu không có token → throw `Error("No token available")`
- Nếu HTTP error → throw `Error("HTTP error! status: {status}")`
- Nếu `success: false` hoặc không có `data` → return `[]`
- Catch error → log error (không block UI)

**Used In:**
- `src/scenes/GrammarTower/GrammarTowerGameOverScene.js:21`
- `src/scenes/GrammarGoodyBag/GrammarGoodyBagGameOverScene.js:20`
- `src/scenes/VocabularyRace/VocabularyRaceGameOverScene.js:20`
- `src/scenes/trainsCars/TrainCarsGameOverScene.js:21`

---

## 4. Complete Game Flow

### 4.1 Flow Diagram

```
1. App Start
   ↓
2. TokenManager.setupListeners() → Listen for token from mobile
   ↓
3. MenuScene.create()
   ↓
4. fetchGameList() → GET /api/v1/game/list-game
   ↓
5. Render game buttons
   ↓
6. User selects game
   ↓
7. {Game}MenuScene.create()
   ↓
8. startGameSession(gameCode) → POST /api/v1/game/start-game
   ↓
9. Store game_id, questions, time_limit
   ↓
10. User clicks "Start"
    ↓
11. {Game}MainScene → Play game
    ↓
12. Game ends → Calculate score
    ↓
13. {Game}GameOverScene.init({ gameId, points })
    ↓
14. endGameSession(gameId, score) → POST /api/v1/game/answer-batching
    ↓
15. Display score and restart option
```

### 4.2 Data Flow

**Game Session Data:**
```
startGameSession() 
  → Returns: { game_id, game_session_questions, game: { time_limit } }
  → Stored in: MenuScene instance (this.gameId, this.questions, this.timeLimit)
  → Passed to: MainScene via scene data
  → Used in: GameOverScene to submit score
```

**Score Calculation:**
- Score được tính trong MainScene
- Được pass qua `scene.start("GameOverScene", { gameId, points })`
- Được submit trong GameOverScene

---

## 5. Error Handling Patterns

### 5.1 Token Errors
- **No token available**: Tất cả API calls sẽ throw error nếu không có token
- **Token expired**: Backend sẽ return 401/403, frontend sẽ throw HTTP error

### 5.2 API Errors
- **Network errors**: Caught và logged, có thể có fallback behavior
- **HTTP errors**: Throw với status code
- **Invalid response**: Return empty array `[]` nếu `success: false`

### 5.3 Fallback Behavior
- **Start Game Session fails**: Continue với default/hardcoded questions
- **End Game Session fails**: Log error nhưng không block UI (user vẫn thấy score)
- **Fetch Game List fails**: Return empty array, menu sẽ không có games

---

## 6. Code Structure

### 6.1 API Service
**File:** `src/services/api.js`

**Exports:**
- `fetchGameList()` - Get game list
- `startGameSession(gameCode)` - Start new game session
- `endGameSession(gameId, score)` - End game session and submit score

**Dependencies:**
- `tokenManager` from `../tokenManager`
- `VITE_API_URL` from environment variables

### 6.2 Token Manager
**File:** `src/tokenManager.js`

**Features:**
- Singleton pattern
- Event emitter (on/off/emit)
- Token storage (memory + localStorage)
- Message listeners (window.postMessage, document.addEventListener)
- Helper method: `fetchWithToken(url, options)`

**Events:**
- `token-updated` - Emitted when token changes
- `token-cleared` - Emitted when token is cleared

---

## 7. Environment Variables

**Required:**
- `VITE_API_URL` - Base URL của API server

**Example:**
```env
VITE_API_URL=https://api.example.com
```

---

## 8. Testing Notes

### 8.1 Test Scenarios

1. **Token Flow:**
   - Test token nhận từ mobile app
   - Test token persistence (localStorage)
   - Test token attach vào API headers

2. **API Calls:**
   - Test fetchGameList với valid token
   - Test startGameSession với các game codes khác nhau
   - Test endGameSession với gameId và score

3. **Error Cases:**
   - Test API calls không có token
   - Test API calls với invalid token
   - Test network errors
   - Test invalid responses

### 8.2 Mock Data

**Game List Response:**
```json
{
  "success": true,
  "data": [
    { "name": "Grammar Tower", "code": "grammar_tower", "is_accessible": true },
    { "name": "Grammar Goody Bag", "code": "goody_bag", "is_accessible": true },
    { "name": "Vocabulary Race", "code": "vocab_race", "is_accessible": false },
    { "name": "Train Cars", "code": "trains_cars", "is_accessible": true }
  ]
}
```

**Start Game Session Response:**
```json
{
  "success": true,
  "data": {
    "game_id": "session_123",
    "game_session_questions": [
      {
        "question": {
          "content": "What is the capital of France?",
          "options": [
            { "text": "Paris", "is_correct": true },
            { "text": "London", "is_correct": false },
            { "text": "Berlin", "is_correct": false },
            { "text": "Madrid", "is_correct": false }
          ]
        }
      }
    ],
    "game": {
      "time_limit": 180
    }
  }
}
```

---

## 9. Integration với Mobile App

### 9.1 Token Communication

**Mobile → WebView:**
```javascript
// React Native example
webViewRef.current.postMessage(JSON.stringify({
  type: "AUTH_TOKEN",
  token: "bearer_token_here"
}));
```

**WebView → Mobile:**
```javascript
// Check premium access
tokenManager.postMessageToMobile({
  type: "check-access-premium"
});
```

### 9.2 Message Types

**From Mobile:**
- `AUTH_TOKEN` hoặc `TOKEN` - Gửi authentication token

**To Mobile:**
- `check-access-premium` - Check user có premium access không

---

## 10. Notes cho Developers

### 10.1 Khi thêm API mới

1. Thêm function vào `src/services/api.js`
2. Sử dụng `tokenManager.getToken()` để lấy token
3. Attach token vào header: `Authorization: Bearer ${token}`
4. Handle errors theo pattern hiện tại
5. Update documentation này

### 10.2 Best Practices

- **Luôn check token trước khi call API**
- **Handle errors gracefully** - không crash app
- **Log errors** để debug
- **Return sensible defaults** khi API fails (empty array, null, etc.)
- **Validate response structure** trước khi sử dụng data

### 10.3 Common Issues

1. **Token không được nhận**: Check mobile app có gửi message đúng format không
2. **CORS errors**: Check API server có allow origin của web app không
3. **401/403 errors**: Token expired hoặc invalid, cần refresh token
4. **Network errors**: Check internet connection và API URL

---

## 11. API Response Structure

Tất cả API responses đều follow format:

```json
{
  "success": boolean,
  "message": "string",
  "data": any
}
```

**Success Case:**
- `success: true`
- `data` chứa actual data
- `message` có thể có hoặc không

**Error Case:**
- `success: false`
- `message` chứa error message
- `data` có thể null hoặc empty

---

## 12. Changelog

- **Initial version**: Document tất cả 3 API endpoints và flows
- Tất cả APIs đều sử dụng Bearer token authentication
- Token được quản lý bởi TokenManager singleton

---

**Last Updated:** 2024
**Maintained By:** Development Team