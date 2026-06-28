// Import các thư viện cần thiết cho Backend Node.js
const express = require('express');
const axios = require('axios');
const app = express();

// Sử dụng middleware để giải mã dữ liệu JSON gửi đến từ Webhook Snipcart
app.use(express.json());

/**
 * Route lắng nghe Webhook từ Snipcart
 * Bạn cần cấu hình URL này trong Dashboard của Snipcart (ví dụ: https://your-app.onrender.com/snipcart-webhook)
 */
app.post('/snipcart-webhook', async (req, res) => {
  const event = req.body;

  console.log(`🔔 [Webhook] Nhận được sự kiện từ Snipcart: ${event.eventName}`);

  // Kiểm tra nếu là sự kiện đơn hàng đã hoàn tất thành công (order.completed)
  if (event.eventName === 'order.completed') {
    const order = event.content;
    
    // Lấy thông tin email bất kỳ khách hàng nhập lúc thanh toán
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
        user_id: process.env.EMAILJS_PUBLIC_KEY, // Public Key của bạn
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
      // Ghi nhận lỗi chi tiết từ API EmailJS nếu có
      console.error('❌ [EmailJS] Lỗi gửi email:', error.response?.data || error.message);
      return res.status(500).send('Lỗi hệ thống khi gửi email qua EmailJS');
    }
  }

  // Trả về trạng thái 200 cho các sự kiện khác của Snipcart để tránh Snipcart thử lại liên tục
  res.status(200).send('Sự kiện không được hỗ trợ');
});

// Thiết lập cổng (Port) chạy máy chủ
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang lắng nghe ổn định tại cổng ${PORT}`);
});
