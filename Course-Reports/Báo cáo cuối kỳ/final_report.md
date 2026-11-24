# BÁO CÁO CUỐI KỲ - ĐỒ ÁN THỰC TẾ CÔNG NGHỆ PHẦN MỀM
## TRƯỜNG ĐẠI HỌC GIAO THÔNG VẬN TẢI TP. HỒ CHÍ MINH - VIỆN ĐÀO TẠO CHẤT LƯỢNG CAO (SHAPE)

> **ĐỀ TÀI**: **PDF-LINGUA: NỀN TẢNG WEB TRÍCH XUẤT VĂN BẢN PDF, OCR ĐA NGÔN NGỮ, DỊCH THUẬT SONG NGỮ VÀ TRỢ LÝ AI HỎI ĐÁP TÀI LIỆU**  
> - **Học phần**: Đồ án Thực tế Công nghệ Phần mềm  
> - **Nhóm thực hiện**: Group 19  
>   1. Nguyễn Lê Huy Tâm - MSSV: `056206011188` (Trưởng nhóm)  
>   2. Huỳnh Đình Chấn - MSSV: `077206002307` (Thành viên)  
> - **Giảng viên hướng dẫn**: TS. Lê Văn Quốc Anh  
> - **Website trực tuyến (Live Demo)**: [https://pdflingua.vercel.app](https://pdflingua.vercel.app)  
> - **Thời gian**: Tháng 11 Năm 2026
---

## LỜI CẢM ƠN

Để hoàn thành đồ án môn học Đồ án Thực tế Công nghệ Phần mềm và xây dựng thành công nền tảng phần mềm PDF-Lingua, nhóm chúng em đã nhận được sự hướng dẫn tận tình, hỗ trợ chuyên môn sâu sắc từ quý Thầy Cô, đặc biệt là **TS. Lê Văn Quốc Anh** - Giảng viên hướng dẫn khoa học, Trường Đại học Giao thông Vận tải TP. Hồ Chí Minh.

Chúng em xin gửi lời tri ân chân thành và sâu sắc nhất đến TS. Lê Văn Quốc Anh đã luôn đồng hành, định hướng phương pháp luận khoa học, góp ý xác đáng từ khâu khảo sát nghiệp vụ, phân tích thiết kế kiến trúc, tổ chức quy trình Scrum đến việc giải quyết các thách thức kỹ thuật phức tạp trong xử lý tài liệu số, OCR đa ngôn ngữ và tích hợp trí tuệ nhân tạo. Những kiến thức quý báu cùng tinh thần trách nhiệm mà Thầy truyền đạt không chỉ giúp chúng em hoàn thiện sản phẩm đạt chuẩn chất lượng cao mà còn trang bị cho chúng em tác phong làm việc thực tế của một kỹ sư công nghệ phần mềm chuyên nghiệp.

Nhóm cũng xin bày tỏ lòng biết ơn đến Ban Giám hiệu Trường Đại học Giao thông Vận tải TP. Hồ Chí Minh, Ban Lãnh đạo Viện Đào tạo Chất lượng cao và các Thầy Cô Khoa Công nghệ Thông tin đã tạo điều kiện học tập tốt nhất, cung cấp môi trường học thuật chất lượng để chúng em phát huy tối đa năng lực sáng tạo.

Mặc dù nhóm đã nỗ lực hết mình và tập trung cao độ trong suốt 7 Sprint để nghiên cứu, phát triển và kiểm thử toàn diện hệ thống, bài báo cáo và sản phẩm chắc chắn khó tránh khỏi những thiếu sót nhất định. Nhóm chúng em rất mong nhận được những nhận xét, đánh giá và chỉ dẫn quý báu từ Thầy và Hội đồng đánh giá để sản phẩm ngày càng hoàn thiện hơn nữa.

*TP. Hồ Chí Minh, Ngày 24 Tháng 11 Năm 2026*  
**Nhóm Sinh Viên Thực Hiện**: Nguyễn Lê Huy Tâm, Huỳnh Đình Chấn
---

## TRANG CAM KẾT

Chúng em xin cam đoan toàn bộ nội dung trong bản báo cáo này, cùng với toàn bộ mã nguồn và hệ thống phần mềm PDF-Lingua, là kết quả nghiên cứu, thiết kế, hiện thực hóa và kiểm thử thực tế do chính nhóm sinh viên chúng em (Nhóm 19) tự lực thực hiện dưới sự hướng dẫn trực tiếp của TS. Lê Văn Quốc Anh.

Chúng em cam kết:

1. **Tính trung thực và liêm chính học thuật**: Mọi số liệu kiểm thử, kết quả đo lường độ chính xác (CER, WER), kiến trúc phân hệ, lược đồ Use Case, lược đồ Lớp và mã nguồn ứng dụng đều được trích xuất trực tiếp từ kho mã nguồn thực tế của dự án, hoàn toàn không sao chép, ngụy tạo hay bịa đặt dưới bất kỳ hình thức nào.
2. **Tính nguyên bản của kết quả nghiên cứu**: Các kết quả nghiên cứu, phân tích thiết kế và hiện thực trong báo cáo này chưa từng được nộp, bảo vệ hay sử dụng cho bất kỳ đề tài, đồ án hoặc học phần cùng cấp nào khác tại Trường Đại học Giao thông Vận tải TP. Hồ Chí Minh cũng như các cơ sở giáo dục khác.
3. **Tuân thủ quyền sở hữu trí tuệ**: Tất cả các tài liệu tham khảo, các thư viện mã nguồn mở bên thứ ba và tài liệu nghiên cứu khoa học được trích dẫn đầy đủ và minh bạch theo quy chuẩn học thuật hiện hành.

Nếu có bất kỳ sự vi phạm nào về liêm chính học thuật, nhóm chúng em xin hoàn toàn chịu trách nhiệm trước kỷ luật của Nhà trường và Viện Đào tạo Chất lượng cao.

*TP. Hồ Chí Minh, Ngày 24 Tháng 11 Năm 2026*  
**Sinh Viên Cam Kết**: Nguyễn Lê Huy Tâm, Huỳnh Đình Chấn
---

## NHẬN XÉT CỦA GIẢNG VIÊN HƯỚNG DẪN

| STT | Tiêu chí đánh giá chuyên môn | Điểm tối đa | Điểm đánh giá |
| :---: | :--- | :---: | :---: |
| 1 | Tinh thần, thái độ làm việc và tuân thủ quy trình Scrum qua 7 Sprint | 2.0 | |
| 2 | Phương pháp phân tích yêu cầu, mô hình hóa kiến trúc và lược đồ UML | 2.0 | |
| 3 | Mức độ hoàn thiện sản phẩm phần mềm, độ phức tạp kỹ thuật (OCR, AI RAG, VietQR) | 3.0 | |
| 4 | Chất lượng kiểm thử tự động, độ ổn định hệ thống và an toàn bảo mật (CI/CD, Security) | 1.5 | |
| 5 | Hình thức trình bày báo cáo kỹ thuật, tính logic và tài liệu bàn giao | 1.5 | |
| | **TỔNG ĐIỂM ĐÁNH GIÁ CUỐI KỲ** | **10.0** | |

**Nhận xét chung của Giảng viên**:

................................................................................................................................

*TP. Hồ Chí Minh, Ngày .... Tháng 11 Năm 2026*  
**Giảng viên hướng dẫn**: TS. Lê Văn Quốc Anh
---

## DANH MỤC THUẬT NGỮ VIẾT TẮT

| STT | Tiếng Anh | Tiếng Việt | Viết Tắt |
| :---: | :--- | :--- | :---: |
| 1 | Application Programming Interface | Giao diện lập trình ứng dụng | **API** |
| 2 | Optical Character Recognition | Nhận dạng ký tự quang học từ hình ảnh/scan | **OCR** |
| 3 | Large Language Model | Mô hình ngôn ngữ lớn (trí tuệ nhân tạo) | **LLM** |
| 4 | Retrieval-Augmented Generation | Tạo sinh tăng cường truy xuất ngữ cảnh | **RAG** |
| 5 | JSON Web Token | Chuỗi mã định danh xác thực phiên người dùng | **JWT** |
| 6 | Object-Relational Mapping | Ánh xạ cơ sở dữ liệu quan hệ sang đối tượng | **ORM** |
| 7 | Single Page Application | Ứng dụng web tương tác đơn trang | **SPA** |
| 8 | Server-Sent Events | Kênh truyền phát sự kiện từ máy chủ thời gian thực | **SSE** |
| 9 | Role-Based Access Control | Kiểm soát truy cập và phân quyền theo vai trò | **RBAC** |
| 10 | Continuous Integration / Continuous Deployment | Tích hợp và triển khai phần mềm liên tục | **CI/CD** |
| 11 | Character Error Rate | Tỷ lệ lỗi ký tự trong đánh giá OCR | **CER** |
| 12 | Word Error Rate | Tỷ lệ lỗi từ ngữ trong đánh giá nhận dạng văn bản | **WER** |
| 13 | Personally Identifiable Information | Dữ liệu định danh cá nhân và thông tin nhạy cảm | **PII** |
| 14 | Write-Ahead Logging | Cơ chế ghi nhật ký phục hồi trước khi cập nhật CSDL | **WAL** |
| 15 | Non-Functional Requirements | Hệ thống các yêu cầu phi chức năng | **NFR** |
| 16 | Proof of Concept | Minh chứng tính khả thi của giải pháp kỹ thuật | **PoC** |

---

## MỤC LỤC NỘI DUNG BÁO CÁO

- **LỜI CẢM ƠN** .................... *Trang 2*
- **TRANG CAM KẾT** .................... *Trang 3*
- **NHẬN XÉT CỦA GIẢNG VIÊN HƯỚNG DẪN** .................... *Trang 4*
- **DANH MỤC THUẬT NGỮ VIẾT TẮT** .................... *Trang 5*
- **MỤC LỤC BÁO CÁO** .................... *Trang 6*
- **CHƯƠNG 1: TỔNG QUAN ĐỀ TÀI VÀ BỐI CẢNH DỰ ÁN** .................... *Trang 7*
- **  1.1. Đặt vấn đề và tính cấp thiết của đề tài** .................... *Trang 7*
- **  1.2. Mục tiêu nghiên cứu và giải pháp đề xuất** .................... *Trang 8*
- **  1.3. Đối tượng sử dụng và phạm vi ứng dụng** .................... *Trang 8*
- **  1.4. Ý nghĩa khoa học và giá trị thực tiễn** .................... *Trang 9*
- **CHƯƠNG 2: PHÂN TÍCH YÊU CẦU HỆ THỐNG** .................... *Trang 10*
- **  2.1. Quy trình phát triển phần mềm Agile/Scrum qua 7 Sprint** .................... *Trang 10*
- **  2.2. Phân tích tác nhân (Actors) và Ma trận phân quyền RBAC** .................... *Trang 11*
- **  2.3. Hệ thống 10 nhóm yêu cầu chức năng cốt lõi** .................... *Trang 12*
- **  2.4. Sơ đồ Use Case tổng quát và đặc tả các Use Case trọng tâm** .................... *Trang 14*
- **  2.5. Yêu cầu phi chức năng (Hiệu năng, Bảo mật, Độ tin cậy)** .................... *Trang 16*
- **CHƯƠNG 3: THIẾT KẾ KIẾN TRÚC VÀ HỆ THỐNG** .................... *Trang 18*
- **  3.1. Mô hình kiến trúc phân tầng chuyên sâu (3-Tier Architecture)** .................... *Trang 18*
- **  3.2. Sơ đồ kiến trúc tổng thể và phân rã 8 phân hệ cốt lõi** .................... *Trang 19*
- **  3.3. Thiết kế Cơ sở dữ liệu và Sơ đồ lớp (Class Diagram)** .................... *Trang 21*
- **  3.4. Thiết kế các luồng xử lý và tương tác API thời gian thực** .................... *Trang 23*
- **  3.5. Thiết kế giao diện người dùng Modern Academic Dual-Pane** .................... *Trang 25*
- **CHƯƠNG 4: HIỆN THỰC HÓA HỆ THỐNG VÀ CÔNG NGHỆ ÁP DỤNG** .................... *Trang 27*
- **  4.1. Công nghệ nền tảng và môi trường phát triển** .................... *Trang 27*
- **  4.2. Hiện thực phân hệ lõi xử lý văn bản PDF và OCR nâng cao** .................... *Trang 28*
- **  4.3. Hiện thực phân hệ Dịch thuật đa ngôn ngữ song song** .................... *Trang 30*
- **  4.4. Hiện thực phân hệ AI Tóm tắt và Trợ lý hỏi đáp tài liệu (RAG)** .................... *Trang 31*
- **  4.5. Hiện thực phân hệ Nâng cấp Pro, Cổng thanh toán VietQR và Native Ads** .................... *Trang 33*
- **  4.6. Hiện thực phân hệ Quản trị hệ thống Admin và Giám sát hạn ngạch** .................... *Trang 34*
- **CHƯƠNG 5: KIỂM THỬ, ĐÁNH GIÁ CHẤT LƯỢNG VÀ QUY TRÌNH CI/CD** .................... *Trang 36*
- **  5.1. Chiến lược kiểm thử tự động hóa (Test Pyramid)** .................... *Trang 36*
- **  5.2. Kết quả kiểm thử Frontend (28/28 Suites PASSED)** .................... *Trang 37*
- **  5.3. Kết quả kiểm thử Backend (12 Suites, 152 Test Cases PASSED)** .................... *Trang 38*
- **  5.4. Đánh giá chất lượng bóc tách, OCR và dịch thuật (CER, WER)** .................... *Trang 39*
- **  5.5. Đánh giá an toàn bảo mật và rà soát mã nguồn tự động** .................... *Trang 40*
- **  5.6. Quy trình Tích hợp và Triển khai liên tục (CI/CD GitHub Actions)** .................... *Trang 41*
- **CHƯƠNG 6: TỔNG KẾT, ĐÓNG GÓP VÀ HƯỚNG PHÁT TRIỂN** .................... *Trang 43*
- **  6.1. Đánh giá kết quả đạt được so với mục tiêu ban đầu** .................... *Trang 43*
- **  6.2. Bảng phân công và tổng kết mức độ đóng góp của từng thành viên** .................... *Trang 44*
- **  6.3. Những khó khăn, thách thức và bài học kinh nghiệm rút ra** .................... *Trang 45*
- **  6.4. Định hướng phát triển và mở rộng trong tương lai** .................... *Trang 46*
- **TÀI LIỆU THAM KHẢO** .................... *Trang 47*

---


# CHƯƠNG 1: TỔNG QUAN ĐỀ TÀI VÀ BỐI CẢNH DỰ ÁN


## 1.1. Đặt vấn đề và tính cấp thiết của đề tài

Trong thời đại cách mạng công nghiệp 4.0 và chuyển đổi số giáo dục, nhu cầu tiếp cận tri thức khoa học kỹ thuật toàn cầu qua tài liệu PDF ngày càng tăng. Tuy nhiên, do bản chất PDF là định dạng cố định tọa độ in ấn, người dùng gặp các rào cản nghiêm trọng: nối sai câu khi ngắt dòng, trộn lẫn nội dung đa cột, vỡ cấu trúc bảng biểu và không thể sao chép trên tài liệu scan quang học.


## 1.2. Mục tiêu nghiên cứu và giải pháp đề xuất

Mục tiêu của đề tài là xây dựng hệ thống toàn diện giải quyết triệt để các hạn chế trên: phát triển bộ trích xuất văn bản lai Fast-Path & OCR Tesseract; nắn thẳng góc nghiêng Deskew; bảo tồn bố cục đa cột và bảng biểu; hiển thị không gian làm việc song ngữ Dual-Pane; tích hợp Trợ lý AI hỏi đáp RAG bảo mật cao; và triển khai ứng dụng thực tế tại https://pdflingua.vercel.app.


## 1.3. Đối tượng sử dụng và phạm vi ứng dụng

Đối tượng phục vụ trọng tâm gồm Sinh viên, Học viên, Giảng viên, Nghiên cứu sinh, Dịch giả và Quản trị viên hệ thống.


## 1.4. Ý nghĩa khoa học và giá trị thực tiễn


# CHƯƠNG 2: PHÂN TÍCH YÊU CẦU HỆ THỐNG


## 2.1. Quy trình phát triển phần mềm Agile/Scrum qua 7 Sprint

Dự án được tổ chức phát triển bài bản theo phương pháp Agile/Scrum qua 7 Sprint tuần, theo dõi trên Jira Software với mã dự án PDFL, phân bổ vào 16 Epics và 287 work items.


## 2.2. Phân tích tác nhân (Actors) và Ma trận phân quyền RBAC


## 2.3. Hệ thống 10 nhóm yêu cầu chức năng cốt lõi


## 2.4. Sơ đồ Use Case tổng quát và đặc tả các Use Case trọng tâm


## 2.5. Yêu cầu phi chức năng (Non-Functional Requirements)


# CHƯƠNG 3: THIẾT KẾ KIẾN TRÚC VÀ HỆ THỐNG


## 3.1. Mô hình kiến trúc phân tầng chuyên sâu (3-Tier Layered Architecture)


## 3.2. Sơ đồ kiến trúc tổng thể và phân rã 8 phân hệ cốt lõi


## 3.3. Thiết kế Cơ sở dữ liệu và Sơ đồ lớp (Class Diagram)


## 3.4. Thiết kế các luồng xử lý và tương tác API thời gian thực


## 3.5. Thiết kế giao diện người dùng Modern Academic Dual-Pane


# CHƯƠNG 4: HIỆN THỰC HÓA HỆ THỐNG VÀ CÔNG NGHỆ ÁP DỤNG


## 4.1. Công nghệ nền tảng và môi trường phát triển


## 4.2. Hiện thực phân hệ lõi xử lý văn bản PDF và OCR nâng cao


## 4.3. Hiện thực phân hệ Dịch thuật đa ngôn ngữ song song


## 4.4. Hiện thực phân hệ AI Tóm tắt và Trợ lý hỏi đáp tài liệu (RAG)


## 4.5. Hiện thực phân hệ Nâng cấp Pro, Cổng thanh toán VietQR và Native Ads


## 4.6. Hiện thực phân hệ Quản trị hệ thống Admin và Giám sát hạn ngạch


# CHƯƠNG 5: KIỂM THỬ, ĐÁNH GIÁ CHẤT LƯỢNG VÀ QUY TRÌNH CI/CD


## 5.1. Chiến lược kiểm thử tự động hóa (Test Pyramid)


## 5.2. Kết quả kiểm thử Frontend (28/28 Suites PASSED)


## 5.3. Kết quả kiểm thử Backend (12 Suites, 152 Test Cases PASSED)


## 5.4. Đánh giá chất lượng bóc tách, OCR và dịch thuật (CER, WER)


## 5.5. Đánh giá an toàn bảo mật và rà soát mã nguồn tự động


## 5.6. Quy trình Tích hợp và Triển khai liên tục (CI/CD GitHub Actions)


# CHƯƠNG 6: TỔNG KẾT, ĐÓNG GÓP VÀ HƯỚNG PHÁT TRIỂN


## 6.1. Đánh giá kết quả đạt được so với mục tiêu ban đầu


## 6.2. Bảng phân công và tổng kết mức độ đóng góp của từng thành viên


## 6.3. Những khó khăn, thách thức và bài học kinh nghiệm rút ra


## 6.4. Định hướng phát triển và mở rộng trong tương lai


# TÀI LIỆU THAM KHẢO

- [1] Tiago Ramirez, 'FastAPI: Modern, Fast (High-Performance) Web Framework for Building APIs with Python', O'Reilly Media, 2023.
- [2] Ray Smith, 'An Overview of the Tesseract OCR Engine', Proceedings of the Ninth International Conference on Document Analysis and Recognition (ICDAR), IEEE, 2007.
- [3] Ashish Vaswani et al., 'Attention Is All You Need', Advances in Neural Information Processing Systems (NeurIPS), 2017.
- [4] Patrick Lewis et al., 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks', Advances in Neural Information Processing Systems (NeurIPS), 2020.
- [5] Martin Fowler, 'Patterns of Enterprise Application Architecture', Addison-Wesley Professional, 2002.
- [6] Robert C. Martin, 'Clean Architecture: A Craftsman's Guide to Software Structure and Design', Prentice Hall, 2017.
- [7] OWASP Foundation, 'OWASP Top 10: The Ten Most Critical Web Application Security Risks', Technical Report, 2021.
- [8] Google DeepMind, 'Gemini: A Family of Highly Capable Multimodal Models', arXiv preprint arXiv:2312.11805, 2023.
- [9] Michael Bayer, 'SQLAlchemy - The Database Toolkit for Python', SQLAlchemy Documentation, 2024.
- [10] Trường Đại học Giao thông Vận tải TP. Hồ Chí Minh, 'Quy định về việc thực hiện và trình bày đồ án tốt nghiệp, đồ án môn học ngành Công nghệ Thông tin', Viện Đào tạo Chất lượng cao, 2024.