# 2. Danh sách task chi tiết

## EPIC 01 — Phân tích yêu cầu và thiết kế hệ thống

- PDFL-1: Xác định các đối tượng sử dụng hệ thống: khách chưa đăng nhập, tài khoản Free, tài khoản Pro và Admin.
- PDFL-2: Chốt danh sách chức năng chính và chức năng mở rộng.
- PDFL-3: Xác định quyền lợi, giới hạn và điểm khác nhau giữa gói Free và Pro.
- PDFL-4: Xác định quy trình xử lý tài liệu từ lúc tải PDF lên đến khi xuất kết quả.
- PDFL-21: Xây dựng Use Case Diagram.
- PDFL-22: Xây dựng sơ đồ hoạt động cho các luồng quan trọng như trích xuất, dịch thuật, AI và nâng cấp gói.
- PDFL-23: Thiết kế kiến trúc tổng thể: Frontend, Backend, database, dịch vụ OCR và dịch vụ AI.
- PDFL-24: Thiết kế ERD và mô hình dữ liệu.
- PDFL-25: Thống nhất cấu trúc API giữa Frontend và Backend.
- PDFL-26: Xác định các yêu cầu phi chức năng: hiệu năng, bảo mật, khả năng mở rộng và trải nghiệm người dùng.

## EPIC 02 — Khởi tạo dự án và môi trường phát triển

- PDFL-27: Tạo repository GitHub `pdf-lingua`.
- PDFL-28: Xây dựng cấu trúc thư mục Frontend và Backend.
- PDFL-29: Khởi tạo ứng dụng Frontend bằng HTML, CSS và JavaScript.
- PDFL-30: Khởi tạo Backend bằng Python và FastAPI.
- PDFL-31: Cấu hình môi trường Python và `requirements.txt` hoặc `pyproject.toml`.
- PDFL-32: Cấu hình các biến môi trường trong `.env`.
- PDFL-33: Tạo `.env.example` và cấu hình `.gitignore`.
- PDFL-34: Cấu hình kết nối database.
- PDFL-35: Thiết lập quy tắc đặt tên branch, commit và Pull Request.
- PDFL-36: Xây dựng API kiểm tra tình trạng hoạt động của Backend.
- PDFL-37: Cấu hình môi trường phát triển để Frontend giao tiếp với Backend.
- PDFL-38: Kiểm tra khởi chạy toàn bộ dự án trên máy phát triển.

## EPIC 03 — Thiết kế giao diện Frontend

- PDFL-39: Xác định phong cách thiết kế, màu sắc, font chữ và bộ quy chuẩn giao diện.
- PDFL-40: Thiết kế thanh điều hướng và bố cục chung của ứng dụng.
- PDFL-41: Xây dựng trang chủ giới thiệu PDF Lingua và các tính năng.
- PDFL-42: Xây dựng trang đăng ký tài khoản.
- PDFL-43: Xây dựng trang đăng nhập.
- PDFL-44: Xây dựng trang thông tin tài khoản.
- PDFL-45: Xây dựng giao diện tải tài liệu PDF.
- PDFL-46: Xây dựng giao diện hiển thị tiến trình tải lên và xử lý tài liệu.
- PDFL-47: Xây dựng giao diện hiển thị văn bản sau khi trích xuất.
- PDFL-48: Xây dựng giao diện chọn ngôn ngữ nguồn và ngôn ngữ đích.
- PDFL-49: Xây dựng giao diện hiển thị bản dịch.
- PDFL-50: Xây dựng giao diện tóm tắt văn bản bằng AI.
- PDFL-51: Xây dựng giao diện trò chuyện với trợ lý AI.
- PDFL-52: Xây dựng giao diện so sánh hoặc chuyển đổi giữa văn bản gốc và bản dịch.
- PDFL-53: Xây dựng giao diện lịch sử xử lý tài liệu.
- PDFL-54: Xây dựng trang giới thiệu và so sánh gói Free/Pro.
- PDFL-55: Xây dựng giao diện nâng cấp gói Pro.
- PDFL-56: Xây dựng giao diện quản trị Admin.
- PDFL-57: Thiết kế trạng thái loading, lỗi, thành công và giao diện khi chưa có dữ liệu.
- PDFL-58: Đảm bảo giao diện responsive trên máy tính, máy tính bảng và điện thoại.
- PDFL-59: Kiểm tra tính nhất quán về thiết kế và khả năng sử dụng.

## EPIC 04 — Backend API và kiến trúc xử lý

- PDFL-60: Thiết kế cấu trúc module Backend theo từng nhóm chức năng.
- PDFL-61: Xây dựng các lớp xử lý nghiệp vụ, truy cập dữ liệu và giao tiếp API.
- PDFL-62: Chuẩn hóa cấu trúc request và response của API.
- PDFL-63: Xây dựng cơ chế xác thực request và xử lý lỗi chung.
- PDFL-64: Cấu hình CORS cho môi trường phát triển và triển khai.
- PDFL-65: Xây dựng API lấy thông tin người dùng hiện tại.
- PDFL-66: Xây dựng API kiểm tra quyền sử dụng tính năng.
- PDFL-67: Xây dựng API kiểm tra giới hạn upload, AI và các hạn mức khác.
- PDFL-68: Chuẩn hóa HTTP status code và thông báo lỗi.
- PDFL-69: Xây dựng tài liệu API bằng OpenAPI/Swagger của FastAPI.
- PDFL-70: Thiết lập logging để theo dõi lỗi và hoạt động xử lý.
- PDFL-71: Xử lý các tác vụ mất nhiều thời gian mà không khóa toàn bộ ứng dụng.

## EPIC 05 — Tài khoản, xác thực và phân quyền

- PDFL-72: Thiết kế bảng dữ liệu tài khoản người dùng.
- PDFL-73: Xây dựng chức năng đăng ký tài khoản.
- PDFL-74: Kiểm tra email và thông tin đăng ký hợp lệ.
- PDFL-75: Mã hóa mật khẩu trước khi lưu vào database.
- PDFL-76: Xây dựng chức năng đăng nhập.
- PDFL-77: Xây dựng cơ chế quản lý phiên đăng nhập hoặc token.
- PDFL-78: Xây dựng chức năng đăng xuất.
- PDFL-79: Xây dựng chức năng xem và cập nhật thông tin tài khoản.
- PDFL-80: Xây dựng chức năng đổi mật khẩu.
- PDFL-81: Kiểm soát quyền truy cập của khách, người dùng đã đăng nhập và Admin.
- PDFL-82: Kiểm tra quyền truy cập khi người dùng gọi trực tiếp API, không chỉ ẩn chức năng trên giao diện.
- PDFL-83: Xử lý trường hợp token hết hạn, tài khoản không tồn tại hoặc thông tin đăng nhập sai.
- PDFL-84: Kiểm tra khả năng truy cập và chỉnh sửa dữ liệu của người dùng khác.

## EPIC 06 — Tải lên và quản lý tài liệu PDF

- PDFL-85: Xây dựng API tải tài liệu PDF lên Backend.
- PDFL-86: Kiểm tra loại file và nội dung file để hạn chế file giả mạo định dạng PDF.
- PDFL-87: Áp dụng giới hạn dung lượng: Free tối đa 20 MB/tệp, Pro tối đa 100 MB/tệp.
- PDFL-88: Kiểm tra PDF bị hỏng, có mật khẩu hoặc không thể đọc.
- PDFL-89: Thiết lập giới hạn số trang được phép xử lý.
- PDFL-90: Lưu trữ file trong thư mục hoặc dịch vụ lưu trữ được cấu hình.
- PDFL-91: Ghi nhận metadata của tài liệu như tên file, dung lượng, số trang, thời gian tải lên và chủ sở hữu.
- PDFL-92: Hiển thị danh sách tài liệu của người dùng.
- PDFL-93: Xem thông tin chi tiết của một tài liệu.
- PDFL-94: Xây dựng chức năng xóa tài liệu.
- PDFL-95: Kiểm soát quyền tải xuống và truy cập file.
- PDFL-96: Xử lý lỗi khi tải file, mất kết nối hoặc quá giới hạn.
- PDFL-97: Xóa các file tạm khi hoàn tất xử lý hoặc khi xảy ra lỗi.
- PDFL-98: Đảm bảo tài liệu riêng tư không bị người dùng khác truy cập.

## EPIC 07 — Trích xuất văn bản và OCR

- PDFL-99: Tích hợp thư viện PyMuPDF để đọc và trích xuất văn bản.
- PDFL-100: Trích xuất văn bản theo từng trang.
- PDFL-101: Xử lý xuống dòng, khoảng trắng và ký tự bất thường.
- PDFL-102: Giữ thứ tự văn bản hợp lý khi tài liệu có nhiều đoạn hoặc nhiều cột.
- PDFL-103: Phát hiện tài liệu có ít hoặc không có văn bản trích xuất được.
- PDFL-104: Tích hợp Tesseract OCR để nhận diện văn bản từ PDF scan.
- PDFL-105: Cấu hình dữ liệu ngôn ngữ OCR cần hỗ trợ, ưu tiên tiếng Việt và tiếng Anh.
- PDFL-106: Kết hợp kết quả OCR với cơ chế trích xuất văn bản thông thường.
- PDFL-107: Xây dựng API trả về nội dung văn bản được trích xuất.
- PDFL-108: Hiển thị kết quả trích xuất trên giao diện.
- PDFL-109: Xử lý tài liệu có trang trống, trang bị xoay hoặc hình ảnh chất lượng thấp.
- PDFL-110: Kiểm thử độ chính xác với PDF thông thường và PDF scan.
- PDFL-111: Tối ưu thời gian xử lý đối với tài liệu nhiều trang.
- PDFL-112: Trả thông báo rõ ràng khi không trích xuất được nội dung.

## EPIC 08 — Dịch thuật đa ngôn ngữ

- PDFL-113: Lựa chọn thư viện hoặc dịch vụ dịch thuật.
- PDFL-114: Xác định danh sách ngôn ngữ nguồn và ngôn ngữ đích được hỗ trợ.
- PDFL-115: Xây dựng chức năng tự động nhận diện ngôn ngữ nguồn nếu dịch vụ hỗ trợ.
- PDFL-116: Xây dựng giao diện chọn ngôn ngữ.
- PDFL-117: Xây dựng API dịch văn bản.
- PDFL-118: Chia văn bản dài thành các đoạn phù hợp với giới hạn của dịch vụ.
- PDFL-119: Giữ thứ tự các đoạn khi ghép kết quả dịch.
- PDFL-120: Xử lý lỗi mạng, giới hạn API và lỗi dịch thuật.
- PDFL-121: Hiển thị bản dịch kèm thông tin ngôn ngữ.
- PDFL-122: Cho phép sao chép bản dịch.
- PDFL-123: Kiểm thử các trường hợp dịch tiếng Việt, tiếng Anh và các ngôn ngữ được lựa chọn.
- PDFL-124: Đánh giá khả năng giữ nguyên đoạn văn, danh sách và nội dung quan trọng khi dịch.
- PDFL-125: Đảm bảo hệ thống không làm mất hoặc đảo thứ tự đoạn khi dịch tài liệu dài.

## EPIC 09 — AI tóm tắt văn bản

- PDFL-126: Lựa chọn mô hình AI hoặc dịch vụ API phù hợp.
- PDFL-127: Quản lý API key thông qua biến môi trường.
- PDFL-128: Xây dựng cấu trúc prompt tóm tắt văn bản.
- PDFL-129: Xây dựng API tóm tắt nội dung tài liệu.
- PDFL-130: Hỗ trợ lựa chọn độ dài hoặc kiểu tóm tắt nếu mô hình cho phép.
- PDFL-131: Hỗ trợ tóm tắt văn bản dài bằng cách chia đoạn hoặc tóm tắt nhiều bước.
- PDFL-132: Hiển thị nội dung tóm tắt trên giao diện.
- PDFL-133: Cho phép sao chép kết quả tóm tắt.
- PDFL-134: Kiểm tra quyền sử dụng AI của tài khoản Pro.
- PDFL-135: Kiểm soát số lượt sử dụng, lượng văn bản đầu vào và chi phí.
- PDFL-136: Xử lý lỗi khi dịch vụ AI không phản hồi hoặc vượt giới hạn.
- PDFL-137: Kiểm thử chất lượng tóm tắt trên các loại tài liệu khác nhau.

## EPIC 10 — Trợ lý AI hỏi đáp tài liệu

- PDFL-138: Xác định phạm vi câu hỏi mà trợ lý AI có thể xử lý.
- PDFL-139: Xây dựng API gửi câu hỏi về tài liệu.
- PDFL-140: Cung cấp nội dung tài liệu liên quan làm ngữ cảnh cho AI.
- PDFL-141: Xử lý tài liệu dài bằng cách chọn các đoạn liên quan trước khi gửi cho AI.
- PDFL-142: Xây dựng giao diện khung chat.
- PDFL-143: Hiển thị câu hỏi và câu trả lời theo thứ tự hội thoại.
- PDFL-144: Xử lý trạng thái AI đang suy nghĩ, câu trả lời lỗi và yêu cầu thử lại.
- PDFL-145: Giới hạn số lượt hỏi đáp hoặc lượng nội dung theo gói dịch vụ.
- PDFL-146: Đảm bảo câu trả lời dựa trên nội dung tài liệu khi người dùng hỏi về tài liệu.
- PDFL-147: Xử lý trường hợp tài liệu không có thông tin để trả lời.
- PDFL-148: Kiểm soát quyền truy cập để người dùng không hỏi hoặc truy xuất tài liệu của người khác.
- PDFL-149: Kiểm thử khả năng trả lời đúng nội dung, hạn chế bịa đặt và xử lý câu hỏi ngoài phạm vi.

## EPIC 11 — Xuất và tải kết quả

- PDFL-150: Xác định các loại kết quả có thể xuất: văn bản gốc, bản dịch và bản tóm tắt.
- PDFL-151: Xây dựng chức năng xuất văn bản thành file TXT.
- PDFL-152: Xây dựng chức năng xuất nội dung thành file PDF.
- PDFL-153: Xây dựng chức năng tải file kết quả về thiết bị người dùng.
- PDFL-154: Đặt tên file kết quả theo tài liệu, ngôn ngữ hoặc loại nội dung.
- PDFL-155: Đảm bảo tiếng Việt và Unicode được hiển thị đúng trong file xuất.
- PDFL-156: Xử lý trường hợp nội dung rỗng hoặc không có kết quả.
- PDFL-157: Kiểm tra quyền tải xuống và quyền truy cập kết quả.
- PDFL-158: Kiểm thử file xuất trên các trình đọc file thông dụng.

## EPIC 12 — Lịch sử xử lý tài liệu

- PDFL-159: Thiết kế bảng dữ liệu lưu lịch sử xử lý.
- PDFL-160: Lưu thông tin tài liệu và loại thao tác đã thực hiện.
- PDFL-161: Lưu kết quả trích xuất, dịch thuật hoặc tóm tắt theo phạm vi chức năng đã thống nhất.
- PDFL-162: Xây dựng API lấy danh sách lịch sử.
- PDFL-163: Xây dựng API xem chi tiết một bản ghi lịch sử.
- PDFL-164: Hiển thị lịch sử trên giao diện.
- PDFL-165: Cho phép mở lại kết quả đã lưu.
- PDFL-166: Cho phép xóa lịch sử theo chính sách lưu trữ.
- PDFL-167: Chỉ cho phép tài khoản Pro sử dụng chức năng lịch sử nếu đây là quyền lợi đã chốt.
- PDFL-168: Kiểm soát quyền truy cập lịch sử theo tài khoản.
- PDFL-169: Xác định thời gian lưu trữ và cách xóa dữ liệu khi cần.
- PDFL-170: Kiểm thử khả năng lưu, truy vấn, mở lại và xóa lịch sử.

## EPIC 13 — Gói Free/Pro và hạn mức sử dụng

- PDFL-171: Thiết kế dữ liệu gói dịch vụ và trạng thái đăng ký của người dùng.
- PDFL-172: Xác định quyền lợi cụ thể của gói Free.
- PDFL-173: Xác định quyền lợi cụ thể của gói Pro.
- PDFL-174: Hiển thị gói hiện tại của người dùng.
- PDFL-175: Xây dựng cơ chế kiểm tra gói dịch vụ ở Backend.
- PDFL-176: Giới hạn tải lên tối đa 20 MB/tệp đối với Free.
- PDFL-177: Giới hạn tải lên tối đa 100 MB/tệp đối với Pro.
- PDFL-178: Xác định và thực thi giới hạn số trang PDF cho từng gói.
- PDFL-179: Xác định hạn mức OCR, dịch thuật và AI theo gói.
- PDFL-180: Chặn hoặc thông báo khi người dùng vượt hạn mức.
- PDFL-181: Xây dựng trang so sánh quyền lợi Free và Pro.
- PDFL-182: Xây dựng luồng yêu cầu nâng cấp lên Pro.
- PDFL-183: Cập nhật quyền sử dụng khi tài khoản được nâng cấp hoặc hạ cấp.
- PDFL-184: Hiển thị thông báo nâng cấp khi người dùng truy cập tính năng dành cho Pro.
- PDFL-185: Kiểm thử việc áp dụng hạn mức ở Backend, kể cả khi người dùng gọi API trực tiếp.

Lưu ý: Gói Pro là quyền lợi dịch vụ, không phải vai trò quản trị. Người dùng Pro không được tự động có quyền Admin.

## EPIC 14 — Quản trị hệ thống Admin

- PDFL-186: Xác định vai trò và quyền hạn của Admin.
- PDFL-187: Thiết lập cách khởi tạo tài khoản Admin an toàn.
- PDFL-188: Xây dựng trang tổng quan quản trị.
- PDFL-189: Hiển thị danh sách tài khoản người dùng.
- PDFL-190: Tìm kiếm và lọc tài khoản theo thông tin phù hợp.
- PDFL-191: Xem thông tin và trạng thái tài khoản.
- PDFL-192: Theo dõi trạng thái gói Free/Pro.
- PDFL-193: Cấp, gia hạn, hạ cấp hoặc thu hồi quyền Pro theo quy định của hệ thống.
- PDFL-194: Khóa hoặc mở khóa tài khoản khi cần.
- PDFL-195: Kiểm soát quyền Admin ở Backend.
- PDFL-196: Ghi nhận nhật ký các thao tác quản trị quan trọng.
- PDFL-197: Xử lý thông báo xác nhận trước những thao tác có ảnh hưởng lớn.
- PDFL-198: Kiểm thử quyền Admin và đảm bảo tài khoản thường không thể truy cập chức năng quản trị.

## EPIC 15 — Kiểm thử, bảo mật và tối ưu

### Kiểm thử chức năng

- PDFL-199: Xây dựng danh sách test case theo yêu cầu chức năng.
- PDFL-200: Viết unit test cho các hàm xử lý nghiệp vụ quan trọng.
- PDFL-201: Kiểm thử API upload, trích xuất, OCR, dịch thuật và AI.
- PDFL-202: Kiểm thử đăng ký, đăng nhập, phân quyền và gói Free/Pro.
- PDFL-203: Kiểm thử lịch sử, xuất file và chức năng Admin.
- PDFL-204: Kiểm thử tích hợp toàn bộ luồng từ tải PDF đến tải kết quả.
- PDFL-205: Kiểm thử giao diện trên các kích thước màn hình khác nhau.
- PDFL-206: Kiểm thử các trường hợp lỗi và trường hợp biên.

### Kiểm thử tài liệu PDF

- PDFL-207: Kiểm thử PDF văn bản thông thường.
- PDFL-208: Kiểm thử PDF scan.
- PDFL-209: Kiểm thử PDF tiếng Việt có dấu và tài liệu đa ngôn ngữ.
- PDFL-210: Kiểm thử PDF nhiều trang, nhiều cột hoặc bố cục phức tạp.
- PDFL-211: Kiểm thử PDF bị hỏng, có mật khẩu hoặc không thể đọc.
- PDFL-212: Kiểm thử file nhỏ, file sát giới hạn và file vượt giới hạn dung lượng.
- PDFL-213: Kiểm thử tài liệu dài khi dịch thuật, tóm tắt và hỏi đáp AI.

### Bảo mật và hiệu năng

- PDFL-214: Kiểm tra an toàn file tải lên và ngăn việc truy cập file ngoài phạm vi cho phép.
- PDFL-215: Đảm bảo mật khẩu không được lưu dưới dạng văn bản thuần.
- PDFL-216: Đảm bảo API key và thông tin nhạy cảm không bị đưa lên GitHub.
- PDFL-217: Kiểm tra xác thực và phân quyền trên các API riêng tư.
- PDFL-218: Giới hạn tần suất request phù hợp để giảm lạm dụng.
- PDFL-219: Kiểm soát dung lượng, số trang, bộ nhớ và thời gian xử lý PDF.
- PDFL-220: Ngăn tài liệu hoặc lịch sử của người dùng này bị truy cập bởi người dùng khác.
- PDFL-221: Xác định chính sách lưu trữ, xóa và bảo vệ dữ liệu người dùng.
- PDFL-222: Hạn chế nội dung không đáng tin cậy trong tài liệu ảnh hưởng đến chỉ dẫn của trợ lý AI.
- PDFL-223: Kiểm tra các lỗi phổ biến như SQL injection, XSS và truy cập trái phép.
- PDFL-224: Đánh giá thời gian trích xuất, OCR, dịch và xử lý AI.
- PDFL-225: Kiểm tra nhiều request đồng thời và giới hạn tài nguyên.
- PDFL-226: Tối ưu quy trình đọc, xử lý và lưu file lớn.
- PDFL-227: Thiết lập thông báo lỗi, logging và cách khôi phục khi xử lý thất bại.

## EPIC 16 — Triển khai, tài liệu và bàn giao

### Triển khai ứng dụng

- PDFL-228: Chọn nền tảng triển khai Frontend.
- PDFL-229: Chọn nền tảng triển khai Backend Python.
- PDFL-230: Chọn nơi lưu trữ PDF và file kết quả.
- PDFL-231: Thiết lập database cho môi trường triển khai.
- PDFL-232: Cấu hình biến môi trường và API key trên môi trường production.
- PDFL-233: Cấu hình CORS, domain và HTTPS nếu nền tảng hỗ trợ.
- PDFL-234: Cài đặt các thành phần cần thiết cho OCR trên server.
- PDFL-235: Kiểm thử ứng dụng trên môi trường triển khai thực tế.
- PDFL-236: Kiểm tra việc xử lý file lớn theo giới hạn đã công bố.
- PDFL-237: Thiết lập kiểm tra tình trạng hoạt động và theo dõi lỗi.
- PDFL-238: Xác định phương án sao lưu và phục hồi database.
- PDFL-239: Kiểm tra quy trình cập nhật phiên bản và khôi phục khi triển khai lỗi.

### Tài liệu và bàn giao

- PDFL-240: Viết README giới thiệu PDF Lingua.
- PDFL-241: Ghi rõ công nghệ sử dụng và yêu cầu cài đặt.
- PDFL-242: Hướng dẫn thiết lập môi trường chạy trên máy cá nhân.
- PDFL-243: Hướng dẫn cấu hình `.env` và các dịch vụ bên ngoài.
- PDFL-244: Mô tả cấu trúc thư mục và kiến trúc hệ thống.
- PDFL-245: Viết tài liệu API và ví dụ request/response.
- PDFL-246: Cung cấp hình ảnh giao diện và hướng dẫn sử dụng.
- PDFL-247: Chuẩn bị dữ liệu PDF mẫu phục vụ demo.
- PDFL-248: Viết báo cáo phân tích, thiết kế, hiện thực và kiểm thử phần mềm.
- PDFL-249: Chuẩn bị slide thuyết trình.
- PDFL-250: Chuẩn bị kịch bản demo các chức năng chính.
- PDFL-251: Kiểm tra README, tài liệu, repository và loại bỏ API key hoặc dữ liệu nhạy cảm trước khi bàn giao.

# 3. Các chức năng mở rộng — chưa cần làm ngay

Những task sau chỉ nên đưa vào Backlog nếu nhóm còn thời gian sau khi các chức năng chính đã ổn định.

- PDFL-252: Cho phép xử lý nhiều file PDF theo lô.
- PDFL-253: Hỗ trợ kéo thả file vào giao diện.
- PDFL-254: Cho phép tải kết quả dưới định dạng DOCX.
- PDFL-255: Cho phép chọn các trang cụ thể cần trích xuất hoặc dịch.
- PDFL-256: Hỗ trợ xem trước PDF và chuyển trang ngay trên ứng dụng.
- PDFL-257: Hỗ trợ lưu hoặc tải lại kết quả dịch theo từng trang.
- PDFL-258: Bổ sung đặt lại mật khẩu qua email.
- PDFL-259: Tích hợp thanh toán trực tuyến cho gói Pro.
- PDFL-260: Gửi thông báo về trạng thái xử lý tài liệu.
- PDFL-261: Cho phép người dùng gửi phản hồi hoặc báo cáo lỗi.
- PDFL-262: Bổ sung thống kê mức sử dụng dịch vụ.
- PDFL-263: Cải thiện khả năng truy xuất nguồn cho câu trả lời AI bằng cách tham chiếu trang hoặc đoạn văn liên quan.
- PDFL-264: Hỗ trợ nhiều chủ đề giao diện hoặc chế độ tối.
- PDFL-265: Xem xét sử dụng hàng đợi tác vụ cho các file lớn và quy trình OCR/AI kéo dài.
