# Hệ Thống Màu Sắc & Chuẩn Giao Diện (Design System - Color Theme)
Dự án: **PDF-Lingua** - Nền tảng dịch thuật tài liệu PDF học thuật & trợ lý AI song ngữ

---

## 1. Triết Lý Thiết Kế & Quy Tắc Phối Màu 60-30-10

Giao diện PDF-Lingua được xây dựng dựa trên phong cách giao diện hiện đại, chuyên nghiệp, loại bỏ các chi tiết thừa thãi và tập trung tối đa vào độ tập trung khi đọc tài liệu học thuật, nghiên cứu và kỹ thuật chuyên sâu.

Quy tắc phối màu được phân bổ chặt chẽ theo tỷ lệ chuẩn thị giác:
- **60% - Không gian nền trung tính (Dominant Neutrals)**: Trắng tinh khiết (`#FFFFFF`) kết hợp cùng các sắc thái xám Slate nhẹ (`#F8FAFC`, `#F1F5F9`) tạo chiều sâu nhẹ nhàng, mang lại cảm giác thoáng đãng và giảm mỏi mắt khi làm việc thời gian dài.
- **30% - Cấu trúc, Phân cấp thị giác & Văn bản (Structural Slate)**: Màu chữ tối (`#0F172A`, `#334155`), đường viền ngăn cách vi tế (`#E2E8F0`, `#CBD5E1`) định hình khung lưới Bento, bảng đối chiếu 2 cột và các thanh điều hướng.
- **10% - Màu sắc điểm nhấn & Kêu gọi hành động (Accent & CTA)**: Đỏ thương hiệu PDF (`#E5322D`) kết hợp điểm xuyết sắc xanh công nghệ Lingua (`#2563EB`, `#4F46E5`) điều hướng ánh nhìn vào các hành động cốt lõi: Tải PDF lên, Bắt đầu miễn phí, Nâng cấp Pro.

```
+-----------------------------------------------------------------------+
|  60% Nền trung tính: Pure White (#FFFFFF) & Slate-50 (#F8FAFC)        |
|  +-----------------------------------------------------------------+  |
|  |  30% Cấu trúc: Text Slate-900 (#0F172A) & Viền Slate (#E2E8F0)  |  |
|  |  +-----------------------------------------------------------+  |  |
|  |  |  10% Điểm nhấn: PDF Red (#E5322D) & Tech Blue (#2563EB)   |  |  |
|  |  +-----------------------------------------------------------+  |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
```

---

## 2. Màu Sắc Thương Hiệu Cốt Lõi (Core Brand Colors)

### 2.1. Đỏ Thương Hiệu PDF (PDF Red Palette)
Màu đỏ đặc trưng đại diện cho định dạng tệp PDF, sự quyết đoán và hành động nhanh chóng. Được áp dụng cho Logo, nút kêu gọi hành động (CTA chính), thanh tiến trình xử lý và các trạng thái quan trọng.

| Tên biến CSS | Mã Màu (HEX) | Mẫu màu | Mục đích sử dụng |
| :--- | :--- | :---: | :--- |
| `--wl-accent-red` / `--color-pdf-coral-dark` | `#E5322D` | `rgb(229,50,45)` | **Màu thương hiệu chính**: Logo PDF badge, nút CTA chính (Tải PDF lên, Bắt đầu miễn phí), viền nổi bật gói Pro |
| `--wl-accent-red-hover` | `#DC2626` | `rgb(220,38,38)` | Trạng thái Hover của nút CTA đỏ, màu kết thúc của Gradient nút bấm |
| `--color-pdf-coral` | `#EF4444` | `rgb(239,68,68)` | Trạng thái cảnh báo nguy hiểm, viền lỗi input (has-error), nút xóa tài liệu |
| `--color-admin-son-red` | `#C9201C` | `rgb(201,32,28)` | Màu riêng biệt cho Quản trị viên (Admin Role), nút quản trị active |
| `--wl-accent-red-subtle` / `--color-pdf-bg` | `#FEF2F2` | `rgb(254,242,242)` | Nền huy hiệu đỏ nhạt, nền Eyebrow badge, nền thông báo lỗi |
| `--color-pdf-bg-alt` | `#FEE2E2` | `rgb(254,226,226)` | Viền và nền thẻ cảnh báo xoá dữ liệu, nền hover cảnh báo |
| `--color-admin-bg` | `#FFF1F0` | `rgb(255,241,240)` | Nền thẻ avatar và menu item Quản trị viên |
| `--wl-accent-red-border` | `rgba(229, 50, 45, 0.2)` | Tương đối | Đường viền trong suốt của các huy hiệu đỏ |

### 2.2. Xanh Dịch Thuật & Trí Tuệ Công Nghệ (Lingua Tech Blue Palette)
Màu xanh đại diện cho trí tuệ nhân tạo, khả năng dịch thuật đa ngôn ngữ và tính năng xử lý học thuật.

| Tên biến CSS | Mã Màu (HEX) | Mẫu màu | Mục đích sử dụng |
| :--- | :--- | :---: | :--- |
| `--wl-accent-blue` / `--color-primary-blue` | `#2563EB` | `rgb(37,99,235)` | **Màu công nghệ chính**: Huy hiệu Tesseract OCR, icon công nghệ, focus ring liên kết |
| `--color-primary-indigo` | `#4F46E5` | `rgb(79,70,229)` | Màu biểu tượng Copilot chat, đường viền active trong workspace |
| `--wl-accent-blue-hover` | `#1D4ED8` | `rgb(29,78,216)` | Trạng thái Hover của các liên kết và nút màu xanh |
| `--color-primary-indigo-dark` | `#4338CA` | `rgb(67,56,202)` | Trạng thái Active/Pressed của các phần tử màu Indigo |
| `--sidebar-btn-bg` | `#5B51D8` | `rgb(91,81,216)` | Màu nút hành động phụ trên Sidebar |
| `--wl-accent-blue-subtle` / `--color-lingua-bg` | `#EFF6FF` | `rgb(239,246,255)` | Nền nhãn tag Original (EN), nền thẻ công nghệ |
| `--sidebar-active-bg` | `#EEF2FF` | `rgb(238,242,255)` | Nền menu item đang được kích hoạt trên thanh điều hướng |
| `--sidebar-active-border` | `#C7D2FE` | `rgb(199,210,254)` | Đường viền menu item active trên sidebar |
| `--color-lingua-cyan` | `#06B6D4` | `rgb(6,182,212)` | Màu nhận diện giọng dịch thuật, bóng phát sáng nhẹ |

---

## 3. Hệ Màu Trung Tính & Phân Cấp Nội Dung (Slate & Neutral Grayscale)

Hệ màu xám xanh Slate tạo nên bộ khung thanh lịch, sạch sẽ cho các khối nội dung, văn bản và đường viền.

| Mã Màu (HEX) | Tên Phân Vị | Phân loại & Ứng dụng cụ thể trong UI/UX |
| :--- | :--- | :--- |
| `#FFFFFF` | **Pure White** | Nền chính của ứng dụng (`--bg-page`), nền thẻ Card (`--bg-card`), nền Modal đối thoại, màu chữ tương phản (`--text-inverse`). |
| `#F8FAFC` | **Slate-50** | Nền trang phụ trợ (`--bg-subtle`), nền vùng thả tệp Dropzone, nền header của bảng đối chiếu song ngữ. |
| `#F1F5F9` | **Slate-100** | Nền trạng thái hover bề mặt (`--bg-surface-hover`), nền khối trực quan Bento, nền nhãn Original (EN) trung tính. |
| `#E2E8F0` | **Slate-200** | Đường viền vi tế (`--border-subtle`), đường kẻ ngang phân tách các hàng bảng, đường bao khung Card. |
| `#CBD5E1` | **Slate-300** | Đường viền nét đứt khi kéo thả tệp (`--border-dashed`), viền Avatar mặc định, thanh ray Gauge Deskew. |
| `#94A3B8` | **Slate-400** | Màu icon phụ (`--text-light`), màu chữ placeholder cho ô tìm kiếm, nhãn đơn vị phụ trợ. |
| `#64748B` | **Slate-500** | Màu văn bản mờ (`--text-muted`), mô tả tính năng phụ, thời gian tạo, chú thích bản quyền Footer. |
| `#475569` | **Slate-600** | Màu phụ đề, nhãn trạng thái tài liệu (`--sidebar-text-secondary`), mô tả các bước quy trình. |
| `#334155` | **Slate-700** | Màu chữ nội dung chính (`--text-body`), văn bản dịch thuật, nội dung câu trả lời của Trợ lý AI. |
| `#0F172A` | **Slate-900** | Màu tiêu đề chính (`--text-title`), thẻ H1, H2, H3, chữ thương hiệu Lingua, số liệu thống kê nổi bật. |

---

## 4. Hệ Màu Tính Năng Nghiệp Vụ (Semantic & Feature Colors)

### 4.1. Phân Hạng Gói Dịch Vụ Pro VIP (Amber Gold)
Đại diện cho sức mạnh mở khóa tính năng cao cấp (xử lý không giới hạn, tóm tắt Map-Reduce, Trợ lý AI hỏi đáp chuyên sâu).

| Mã Màu (HEX) | Tên Phân Vị | Ứng dụng |
| :--- | :--- | :--- |
| `#F59E0B` | **Amber Gold** | Huy hiệu gói Pro, huy hiệu "Phổ biến nhất", huy hiệu Map-Reduce, huy hiệu "Tiết kiệm 32%" |
| `#B45309` / `#92400E` | **Amber Dark** | Màu chữ sắc nét hiển thị trên nền vàng cam |
| `#FEF3C7` | **Amber 100** | Nền huy hiệu Pro, nền avatar người dùng Gói Pro, nền nút pill đang chọn |
| `#FDE68A` / `#FCD34D` | **Amber 200/300** | Đường viền thẻ Pro, viền avatar người dùng gói Pro |

### 4.2. Bảo Mật & Xác Thực Thành Công (Emerald Green)
Đại diện cho tính an toàn dữ liệu, tính năng cô lập thư mục User ID, kiểm soát quyền truy cập RBAC và RAG chống ảo giác.

| Mã Màu (HEX) | Tên Phân Vị | Ứng dụng |
| :--- | :--- | :--- |
| `#10B981` / `#059669` | **Emerald Green** | Huy hiệu "Ngăn Ngừa Ảo Giác", huy hiệu "Bảo Mật RBAC", dấu tích xác thực thành công |
| `#065F46` | **Emerald Dark** | Màu chữ cảnh báo thành công trong khung thông báo (Alert Success) |
| `#ECFDF5` | **Emerald 50** | Nền khung thông báo thành công, nền huy hiệu Bản Dịch (VI) hoàn tất |
| `#A7F3D0` | **Emerald 200** | Đường viền khung thông báo thành công |

### 4.3. Cảnh Báo Nguy Hiểm & Xóa Dữ Liệu (Rose & Danger)
Đại diện cho các thao tác không thể hoàn tác như xoá vĩnh viễn tài liệu, xoá toàn bộ lịch sử trò chuyện hoặc hủy gói cước.

| Mã Màu (HEX) | Tên Phân Vị | Ứng dụng |
| :--- | :--- | :--- |
| `#E11D48` / `#EF4444` | **Rose Danger** | Biểu tượng thùng rác xoá tài liệu, nút xác nhận hủy bỏ |
| `#991B1B` / `#9F1239` | **Rose Dark** | Màu chữ thông báo lỗi nghiêm trọng |
| `#FFF1F2` / `#FEF2F2` | **Rose 50** | Nền modal cảnh báo xoá dữ liệu vĩnh viễn |
| `#FECDD3` / `#FECACA` | **Rose 200** | Đường viền của modal cảnh báo xoá |

---

## 5. Dải Màu Chuyển Sắc & Đổ Bóng (Gradients & Shadows)

### 5.1. Các Dải Màu Gradient Chuẩn (Design Gradients)
```css
/* 1. Gradient Nút CTA Chính (PDF Red Theme) */
background: linear-gradient(135deg, #E5322D 0%, #DC2626 100%);

/* 2. Gradient Nút Thao Tác Nổi Bật (Red-Orange Vibrant) */
background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);

/* 3. Gradient Công Nghệ & Trí Tuệ AI (Tech Lingua) */
background: linear-gradient(135deg, #4F46E5 0%, #2563EB 100%);

/* 4. Gradient Tinh Tế Cho Vùng Chọn (Subtle Ambient) */
background: linear-gradient(135deg, rgba(229, 50, 45, 0.05) 0%, rgba(37, 99, 235, 0.05) 100%);
```

### 5.2. Chuẩn Độ Mờ Trạng Thái (Opacity Matrix)
- **`opacity: 0.42` (`is-dimmed`)**: Áp dụng cho các tính năng yêu cầu nâng cấp gói Pro hoặc yêu cầu đăng nhập đối với tài khoản Khách (Ví dụ: Hỏi đáp AI, Tóm tắt văn bản, Tài liệu, Lịch sử xử lý khi ở chế độ Khách).
- **`opacity: 0.75` (`is-dimmed:hover`)**: Phản hồi thị giác khi người dùng rê chuột vào tính năng đang bị giới hạn, tạo cảm giác có thể tương tác để xem chi tiết yêu cầu.
- **`opacity: 0.85`**: Áp dụng cho các nhãn phụ trong bảng đối chiếu hoặc watermark định danh tài liệu.

### 5.3. Hệ Thống Đổ Bóng Đa Lớp (Elevation & Box Shadow)
```css
/* Đổ bóng nhẹ cho nút phụ, thẻ nhỏ */
--shadow-sm: 0 1px 2px 0 rgba(15, 23, 42, 0.05);

/* Đổ bóng tiêu chuẩn cho Card tài liệu, Thẻ Bento */
--shadow-card: 0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.05);

/* Đổ bóng rực cho nút CTA Đỏ thương hiệu */
--shadow-btn-red: 0 4px 14px 0 rgba(229, 50, 45, 0.28);
--shadow-btn-red-hover: 0 6px 20px 0 rgba(229, 50, 45, 0.35);

/* Đổ bóng cho Modal hộp thoại và Drawer trượt */
--shadow-xl: 0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05);
```

---

## 6. Bảng Tra Cứu Biến Màu CSS Theo Từng Tệp Giao Diện

| Tệp CSS nguồn | Tên biến / Thuộc tính | Giá trị mã màu | Nhóm chức năng |
| :--- | :--- | :--- | :--- |
| `style.css` | `--color-primary-indigo` | `#4F46E5` | Nhận diện tương tác công nghệ |
| `style.css` | `--color-primary-blue` | `#2563EB` | Nhận diện liên kết dịch thuật |
| `style.css` | `--color-pdf-coral` | `#EF4444` | Màu cảnh báo, lỗi |
| `style.css` | `--color-pdf-coral-dark` | `#DC2626` | Đỏ đậm nút bấm |
| `style.css` | `--color-pro-gold` | `#F59E0B` | Màu gói Pro VIP |
| `style.css` | `--color-success` | `#10B981` | Trạng thái hoàn tất thành công |
| `style.css` | `--bg-page` / `--bg-card` | `#FFFFFF` | Nền trang và thẻ |
| `style.css` | `--bg-subtle` | `#F8FAFC` | Nền thứ cấp nhạt |
| `style.css` | `--text-title` | `#0F172A` | Tiêu đề tương phản cao |
| `style.css` | `--text-body` | `#334155` | Chữ nội dung đọc |
| `style.css` | `--text-muted` | `#64748B` | Chữ mờ, chú thích |
| `style.css` | `--border-subtle` | `#E2E8F0` | Viền ngăn cách chuẩn |
| `welcome.css` | `--wl-accent-red` | `#E5322D` | **Đỏ thương hiệu PDF Lingua** |
| `welcome.css` | `--wl-accent-blue` | `#2563EB` | Xanh công nghệ bổ trợ |
| `welcome.css` | `--wl-text-primary` | `#0F172A` | Tiêu đề trang Welcome |
| `welcome.css` | `--wl-bg-subtle` | `#F8FAFC` | Nền các phần xen kẽ |
| `sidebar.css` | `--sidebar-bg` | `#FFFFFF` | Nền thanh điều hướng |
| `sidebar.css` | `--sidebar-active-bg` | `#EEF2FF` | Nền item đang chọn |
| `sidebar.css` | `--sidebar-active-text` | `#4F46E5` | Chữ item đang chọn |
| `sidebar.css` | `--sidebar-hover` | `#F1F5F9` | Nền khi rê chuột vào item |
| `sidebar.css` | `--sidebar-border` | `#E2E8F0` | Đường kẻ dọc ngăn cách |
| `pricing.css` | Viền thẻ Pro | `#E5322D` / `#4F46E5` | Đường bao nổi bật thẻ VIP |
| `pricing.css` | Nền gói Pro nổi bật | `#FFF1F0` / `#FEF3C7` | Nền nhãn giá và huy hiệu |

---

## 7. Quy Chuẩn Kiểm Duyệt Khả Năng Truy Cập (Accessibility & WCAG 2.1)

Mọi thành phần giao diện của dự án PDF-Lingua phải tuân thủ nghiêm ngặt các quy tắc sau:
1. **Độ tương phản văn bản (Contrast Ratio)**:
   - Văn bản nội dung (`#334155`) trên nền trắng (`#FFFFFF`): Đạt tỷ lệ **10.5:1** (vượt xa chuẩn WCAG AAA 7:1).
   - Tiêu đề (`#0F172A`) trên nền trắng: Đạt tỷ lệ **16.1:1** (đảm bảo độ sắc nét tuyệt đối).
   - Nút bấm chữ trắng (`#FFFFFF`) trên nền đỏ (`#E5322D`): Đạt tỷ lệ **4.8:1** (đáp ứng chuẩn WCAG AA).
2. **Quy tắc Focus Ring**:
   - Tất cả các nút bấm, ô nhập liệu và liên kết khi duyệt bằng bàn phím (`:focus-visible`) đều có đường bao nét liền tối thiểu `2px solid #E5322D` hoặc `#2563EB` với khoảng cách đệm `outline-offset: 2px`.
3. **Quy tắc Chống AI Slop**:
   - Nghiêm cấm dùng dải gradient tím neon kiểu cũ (`#7C3AED`, `#6366F1`) làm màu thương hiệu.
   - Không dùng văn bản màu xám quá nhạt (dưới mức `#64748B`) cho các nội dung quan trọng trên nền sáng.

