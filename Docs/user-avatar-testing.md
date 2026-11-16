# User Avatar Testing & Regression Documentation

Tài liệu hướng dẫn và tổng hợp kiểm thử toàn diện tính năng Ảnh đại diện người dùng (User Avatar) thuộc dự án PDF-Lingua, bao gồm các bộ kiểm thử chức năng Avatar, kiểm thử hồi quy xác thực (Authentication), thanh điều hướng & quản lý tài liệu (Sidebar & Document Management) và lịch sử xử lý (History).

---

## 1. Cấu Trúc Các Bộ Kiểm Thử (Test Suites Structure)

Hệ thống kiểm thử cho tính năng User Avatar bao gồm 5 bộ kiểm thử Frontend Avatar, 3 bộ kiểm thử Frontend hồi quy liên quan, và 5 bộ kiểm thử Backend, kiểm tra từ giao diện người dùng, xử lý Canvas, tích hợp API, đồng bộ giao diện cho đến vòng đời hoàn chỉnh:

### 1.1. Frontend Avatar Unit & Integration Test Suites (`Code/frontend/tests/`)

| Tên tệp kiểm thử | Số ca kiểm thử | Phạm vi kiểm tra |
| :--- | :---: | :--- |
| `test_frontend_avatar_modal.js` | 12 | Giao diện Account Modal, nút camera, chọn tệp, xác thực định dạng (.jpg, .png, .webp), dung lượng (<= 2 MB), tệp rỗng (0 bytes), hộp thoại xác nhận xóa avatar. |
| `test_frontend_avatar_crop.js` | 10 | Trình cắt ảnh Canvas HTML5, điều khiển zoom slider/button/wheel, kéo thả repositioning với giới hạn clamping, phím mũi tên, hủy bỏ và xuất File/Blob 1:1. |
| `test_frontend_avatar_upload.js` | 18 | Tích hợp API Upload (`POST /api/auth/me/avatar`) và Delete (`DELETE /api/auth/me/avatar`), xử lý HTTP 401, 403, 413, 415, 500, lỗi mạng, khóa chống gửi trùng lặp (concurrency guard), dọn dẹp Object URL. |
| `test_frontend_avatar_sync.js` | 12 | Đồng bộ tức thì giữa Header, Account Modal và Sidebar sau upload/delete không cần tải lại trang; phục hồi session sau F5; trạng thái Khách; xử lý ảnh hỏng dự phòng (initial letter); chống đệ quy lặp lỗi (recursive error loop); tính lũy thừa listener. |
| `test_frontend_avatar_lifecycle_integration.js` | 9 | Kiểm thử tích hợp toàn bộ vòng đời (End-to-End User Journey) từ lúc đăng nhập, chọn ảnh, cắt ảnh, tải lên, phục hồi session, xóa ảnh đến khi đăng xuất; bảo toàn phân quyền Free, Pro, Admin; ma trận phục hồi lỗi; quản lý bộ nhớ Object URL. |

**Tổng số test Frontend Avatar:** **61/61 PASSED** (100%)

---

### 1.2. Frontend Regression Test Suites (Auth, Sidebar & Document Management)

| Tên tệp kiểm thử | Số ca kiểm thử | Phạm vi kiểm tra |
| :--- | :---: | :--- |
| `test_frontend_login.js` | 39 | Kiểm thử xác thực, đăng nhập, khôi phục session qua `/api/auth/me`, xử lý token hết hạn, đăng xuất, cập nhật thông tin cá nhân (PATCH full_name), đổi mật khẩu (Change Password). |
| `test_frontend_sidebar.js` | 50 | Điều hướng Sidebar, đóng/mở thanh bên, phím tắt Ctrl+B, Mobile drawer, đồng bộ User Profile card; **Quản lý tài liệu (Document Management)**: giao diện danh sách `#documentsSection`, bảng tài liệu `#documentsTableBody`, modal chi tiết `#documentDetailModal`, tải xuống `#btnDocDetailDownload`, xác nhận và thực thi xóa tài liệu `#documentDeleteConfirmModal` qua `DELETE /api/documents/{id}`. |
| `test_frontend_history.js` | 24 | **Lịch sử xử lý tài liệu (Document History)**: nạp danh sách `GET /api/history`, bộ lọc action_type và status, tìm kiếm theo tên tệp, phân trang skip/limit, xem chi tiết lỗi `#historyErrorModal`, xem kết quả dịch thuật/tóm tắt, xóa bản ghi lịch sử `DELETE /api/history/{id}` và dọn dẹp lịch sử `POST /api/history/cleanup`. |

**Tổng số test Frontend Hồi quy:** **113/113 PASSED** (100%)

---

### 1.3. Backend Integration & Security Test Suites (`Code/backend/tests/`)

| Tên tệp kiểm thử | Số ca kiểm thử | Phạm vi kiểm tra |
| :--- | :---: | :--- |
| `test_avatar_api.py` | 17 | Endpoint `POST /api/auth/me/avatar` và `DELETE /api/auth/me/avatar`, multipart validation, xác thực Magic Bytes, giới hạn 2 MB, user isolation. |
| `test_avatar_lifecycle_integration.py` | 3 | Vòng đời upload, replace, serve và delete trên database và filesystem thực tế; rollback an toàn khi xảy ra lỗi. |
| `test_avatar_schema.py` | 11 | Ràng buộc schema SQLAlchemy, migration an toàn, Pydantic DTO serialization, chặn sửa `avatar_url` qua endpoint cập nhật thông tin thường. |
| `test_avatar_serving.py` | 9 | Endpoint phục vụ file tĩnh `GET /api/storage/avatars/{user_id}/{filename}`, Content-Type theo định dạng thực tế, cache headers (`Cache-Control`), chống Path Traversal và Symlink traversal. |
| `test_avatar_storage.py` | 12 | Dịch vụ lưu trữ file: Magic Bytes verification, UUID file naming, dọn dẹp file vật lý mồ côi (orphan cleanup). |

**Tổng số test Backend Avatar:** **52/52 PASSED** (100%)

---

### 1.4. Bảng Tổng Hợp Số Lượng Kiểm Thử Toàn Diện

| Nhóm kiểm thử | Số lượng bộ test | Số test ca | Trạng thái |
| :--- | :---: | :---: | :---: |
| **Frontend Avatar (Unit & Lifecycle Integration)** | 5 | 61 | **61/61 PASS (100%)** |
| **Frontend Regression (Auth, Sidebar & Document Management)** | 3 | 113 | **113/113 PASS (100%)** |
| **Backend Avatar (API, Storage, Serving, Schema, Lifecycle)** | 5 | 52 | **52/52 PASS (100%)** |
| **TỔNG CỘNG HỆ THỐNG** | **13** | **226** | **226/226 PASS (100%)** |

---

## 2. Hướng Dẫn Chạy Kiểm Thử (Execution Commands)

### 2.1. Chạy Từng Bộ Test Frontend Avatar

```powershell
# 1. Kiểm thử giao diện Account Modal & chọn tệp
node Code/frontend/tests/test_frontend_avatar_modal.js

# 2. Kiểm thử trình cắt ảnh Canvas HTML5
node Code/frontend/tests/test_frontend_avatar_crop.js

# 3. Kiểm thử API Upload & Client Validation
node Code/frontend/tests/test_frontend_avatar_upload.js

# 4. Kiểm thử đồng bộ Avatar đa thành phần (Header, Modal, Sidebar)
node Code/frontend/tests/test_frontend_avatar_sync.js

# 5. Kiểm thử tích hợp vòng đời hoàn chỉnh (End-to-End Lifecycle)
node Code/frontend/tests/test_frontend_avatar_lifecycle_integration.js
```

### 2.2. Chạy Toàn Bộ Test Suite Avatar Frontend

```powershell
node Code/frontend/tests/test_frontend_avatar_modal.js; node Code/frontend/tests/test_frontend_avatar_crop.js; node Code/frontend/tests/test_frontend_avatar_upload.js; node Code/frontend/tests/test_frontend_avatar_sync.js; node Code/frontend/tests/test_frontend_avatar_lifecycle_integration.js
```

### 2.3. Chạy Toàn Bộ Kiểm Thử Hồi Quy Frontend (Auth, Sidebar, Document Management & History)

```powershell
node Code/frontend/tests/test_frontend_login.js; node Code/frontend/tests/test_frontend_sidebar.js; node Code/frontend/tests/test_frontend_history.js
```

### 2.4. Chạy Toàn Bộ Bộ Test Backend Avatar

```powershell
Code/backend/venv/Scripts/python.exe -m pytest (Get-ChildItem Code/backend/tests/test_avatar_*.py)
```

---

## 3. Ma Trận Bao Phủ Kịch Bản Lỗi (Failure Scenario Matrix)

| Kịch bản kiểm thử | Hành vi xử lý của hệ thống | Tệp test bao phủ |
| :--- | :--- | :--- |
| **Định dạng file không hợp lệ (.pdf, .gif, .exe)** | Chặn ngay tại client trước khi mở modal cắt ảnh, hiển thị thông báo lỗi thân thiện, xóa giá trị input file. | `test_frontend_avatar_modal.js`<br>`test_frontend_avatar_lifecycle_integration.js` |
| **Dung lượng file vượt quá 2 MB** | Chặn tại client, hiển thị thông báo giới hạn 2 MB, giữ nguyên avatar cũ. | `test_frontend_avatar_modal.js`<br>`test_frontend_avatar_upload.js`<br>`test_frontend_avatar_lifecycle_integration.js` |
| **Tệp rỗng 0 bytes** | Chặn tại client trước khi xử lý, hiển thị cảnh báo tệp rỗng, không gửi request mạng. | `test_frontend_avatar_modal.js`<br>`test_frontend_avatar_upload.js`<br>`test_frontend_avatar_lifecycle_integration.js` |
| **File ảnh hỏng khi nạp vào Crop Modal** | Bắt sự kiện error trên thẻ ảnh, hiển thị alert "Không thể tải hoặc xử lý", vô hiệu hóa nút xác nhận cắt ảnh. | `test_frontend_avatar_crop.js`<br>`test_frontend_avatar_lifecycle_integration.js` |
| **Lỗi khởi tạo Canvas / toBlob null** | Bắt ngoại lệ, hiển thị thông báo lỗi cắt ảnh, khôi phục trạng thái nút bấm, không gọi API upload. | `test_frontend_avatar_lifecycle_integration.js` |
| **HTTP 401 Unauthorized (Hết hạn phiên)** | Xóa token và session trong localStorage, thông báo phiên hết hạn, chuyển giao diện về trạng thái Khách. | `test_frontend_avatar_upload.js`<br>`test_frontend_avatar_lifecycle_integration.js` |
| **HTTP 403 Forbidden (Không có quyền)** | Hiển thị thông báo từ chối quyền truy cập, KHÔNG xóa phiên hợp lệ của người dùng, giữ nguyên avatar hiện tại. | `test_frontend_avatar_upload.js`<br>`test_frontend_avatar_lifecycle_integration.js` |
| **HTTP 500 Internal Server Error** | Hiển thị thông báo lỗi máy chủ thân thiện, giữ nguyên preview và avatar đang có, khôi phục nút bấm. | `test_frontend_avatar_upload.js`<br>`test_frontend_avatar_lifecycle_integration.js` |
| **Mất kết nối mạng (Network failure)** | Bắt lỗi offline, hiển thị thông báo kết nối mạng, phục hồi trạng thái loading, bảo toàn dữ liệu phiên. | `test_frontend_avatar_upload.js`<br>`test_frontend_avatar_lifecycle_integration.js` |
| **Ảnh đại diện bị xóa trên server (Broken URL)** | Sự kiện error trên thẻ ảnh tự động fallback về ký tự viết tắt (initial) và xóa handler, chống lặp lỗi vô hạn. | `test_frontend_avatar_sync.js`<br>`test_frontend_avatar_lifecycle_integration.js` |
| **Tên người dùng có khoảng trắng đầu/cuối** | Tự động trim khoảng trắng thừa trước khi lấy chữ cái đầu, hiển thị ký tự viết tắt chuẩn xác. | `test_frontend_avatar_sync.js`<br>`test_frontend_avatar_lifecycle_integration.js` |

---

## 4. Quản Lý Bộ Nhớ & Dọn Dẹp Tài Nguyên (Memory & Resource Cleanup)

1. **Thu hồi Object URL (`URL.revokeObjectURL`)**:
   - Khi người dùng bấm "Hủy" trong Crop Modal: `cropState.tempObjectUrl` được thu hồi ngay lập tức.
   - Khi người dùng chọn một ảnh khác thay thế ảnh đang chờ: URL tạm thời trước đó được thu hồi trước khi tạo URL mới.
   - Khi upload thành công và nhận URL từ server: URL tạm thời của blob được thu hồi hoàn toàn.
2. **Khôi phục trạng thái nút bấm & Spinners**:
   - Mọi nhánh xử lý (thành công, lỗi client, lỗi server 4xx/5xx, mất mạng) đều có khối `finally` hoặc error handling khôi phục cờ `isUploadingAvatar` và `isDeletingAvatar` về `false`, bật lại các nút bấm và ẩn spinner quay.
