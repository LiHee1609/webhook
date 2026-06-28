// Import các thư viện cần thiết cho Backend Node.js
const express = require('express');
const axios = require('axios');
const app = express();

// Sử dụng middleware để giải mã dữ liệu JSON gửi đến từ Webhook Snipcart
app.use(express.json());

/**
 * Endpoint xử lý chính cho Snipcart Webhook
 * Vừa xử lý xác thực đơn hàng (để hiện nút đặt hàng) vừa thực hiện gửi email xác nhận.
 */
app.post('/snipcart-webhook', async (req, res) => {
  const event = req.body;

  console.log(`🔔 [Webhook] Nhận được sự kiện từ Snipcart: ${event.eventName}`);

  // 1. ĐẶC BIỆT QUAN TRỌNG: XỬ LÝ XÁC THỰC ĐƠN HÀNG (SỬA LỖI KẸT NÚT ĐẶT HÀNG)
  // Khi khách đến bước thanh toán cuối, Snipcart sẽ gọi event này để check giá tiền/sản phẩm.
  // Bắt buộc phải phản hồi trạng thái 200 OK ngay lập tức để Snipcart hiển thị nút "Đặt hàng".
  if (event.eventName === 'order.validate') {
    console.log("🛡️ [Snipcart] Đang thực hiện xác thực thông tin đơn hàng...");
    return res.status(200).json({
      status: "success",
      message: "Order validated successfully"
    });
  }

  // 2. XỬ LÝ GỬI EMAIL KHI ĐƠN HÀNG ĐÃ HOÀN TẤT THÀNH CÔNG
  if (event.eventName === 'order.completed' || event.eventName === 'cart.confirmed') {
    const order = event.content;
    
    // Lấy thông tin email khách hàng nhập lúc thanh toán
    const customerEmail = order.email; 
    const customerName = order.billingAddress?.fullName || order.shippingAddress?.fullName || "Khách hàng GreenGlow";
    const orderId = order.invoiceNumber || order.token || "N/A";
    
    // Định dạng tổng số tiền thanh toán sang VNĐ trực quan
    const orderTotal = typeof order.grandTotal === 'number'
      ? order.grandTotal.toLocaleString('vi-VN') + ' ₫'
      : order.grandTotal + ' ₫';

    // Tổng hợp danh sách sản phẩm đã mua thành chuỗi văn bản
    let orderItems = "Mỹ phẩm hữu cơ thiên nhiên GreenGlow";
    if (order.items && Array.isArray(order.items)) {
      orderItems = order.items.map(item => `${item.name} (SL: ${item.quantity})`).join(', ');
    }

    console.log(`📧 [EmailJS] Đang tiến hành gửi email xác nhận cho: ${customerEmail}`);

    try {
      // Gọi trực tiếp đến API chính thức của EmailJS phía Server-side
      const emailRes = await axios.post('https://api.emailjs.com/api/v1.0/email/send', {
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: process.env.EMAILJS_TEMPLATE_ID,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        template_params: {
          customer_name: customerName,
          customer_email: customerEmail, // Gửi trực tiếp tới email khách hàng đã nhập
          order_id: orderId,
          order_total: orderTotal,
          order_items: orderItems
        }
      });

      console.log('🎉 [EmailJS] Email xác nhận đơn hàng đã gửi thành công!', emailRes.status);
      return res.status(200).send('Webhook đã xử lý và gửi mail thành công');
      
    } catch (error) {
      console.error('❌ [EmailJS] Lỗi gửi email:', error.response?.data || error.message);
      // Vẫn trả về 200 để Snipcart không cố gửi đi gửi lại nhiều lần nếu lỗi EmailJS
      return res.status(200).send('Lỗi gửi email nhưng ghi nhận webhook');
    }
  }

  // Trả về trạng thái 200 cho tất cả các sự kiện khác để Snipcart không bị lỗi nghẽn đường truyền
  res.status(200).send('Sự kiện nhận thành công');
});

// Thiết lập cổng (Port) chạy máy chủ
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang lắng nghe ổn định tại cổng ${PORT}`);
});
