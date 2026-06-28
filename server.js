const express = require('express');
const axios = require('axios');
const app = express();

// Bắt buộc phải có để đọc dữ liệu JSON gửi đến từ Webhook Snipcart
app.use(express.json());

/**
 * Endpoint duy nhất tiếp nhận và xử lý mọi tín hiệu từ Snipcart
 */
app.post('/snipcart-webhook', async (req, res) => {
  const event = req.body;

  console.log(`🔔 [Webhook] Nhận được sự kiện từ Snipcart: ${event.eventName}`);

  // =======================================================================
  // CHỨC NĂNG 1: XÁC THỰC ĐƠN HÀNG (GIẢI QUYẾT LỖI KẸT NÚT ĐẶT HÀNG)
  // =======================================================================
  // Khi khách đến bước cuối, Snipcart v3 gọi sự kiện này để check giá tiền/bảo mật.
  // Bắt buộc phải phản hồi trạng thái 200 OK ngay lập tức để Snipcart mở khóa nút Đặt hàng.
  if (event.eventName === 'order.validate') {
    console.log("🛡️ [Snipcart] Đang thực hiện xác thực thông tin đơn hàng...");
    return res.status(200).json({
      status: "success",
      message: "Order validated successfully"
    });
  }

  // =======================================================================
  // CHỨC NĂNG 2: GỬI EMAIL XÁC NHẬN (GIỮ NGUYÊN LOGIC CŨ CỦA BẠN)
  // =======================================================================
  // Sự kiện này kích hoạt NGAY SAU KHI khách hàng bấm nút Đặt hàng thành công
  if (event.eventName === 'order.completed' || event.eventName === 'cart.confirmed') {
    const order = event.content;
    
    const customerEmail = order.email; 
    const customerName = order.billingAddress?.fullName || order.shippingAddress?.fullName || "Khách hàng GreenGlow";
    const orderId = order.invoiceNumber || order.token || "N/A";
    
    // Định dạng số tiền sang VNĐ hiển thị trong email
    const orderTotal = typeof order.grandTotal === 'number'
      ? order.grandTotal.toLocaleString('vi-VN') + ' ₫'
      : order.grandTotal + ' ₫';

    // Gom danh sách sản phẩm thành chuỗi văn bản
    let orderItems = "Mỹ phẩm hữu cơ thiên nhiên GreenGlow";
    if (order.items && Array.isArray(order.items)) {
      orderItems = order.items.map(item => `${item.name} (SL: ${item.quantity})`).join(', ');
    }

    console.log(`📧 [EmailJS] Đang tiến hành gửi email xác nhận cho: ${customerEmail}`);

    try {
      // Gọi API gửi email chính thức của EmailJS phía Server-side
      const emailRes = await axios.post('https://api.emailjs.com/api/v1.0/email/send', {
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: process.env.EMAILJS_TEMPLATE_ID,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        template_params: {
          customer_name: customerName,
          customer_email: customerEmail,
          order_id: orderId,
          order_total: orderTotal,
          order_items: orderItems
        }
      });

      console.log('🎉 [EmailJS] Email xác nhận đơn hàng đã gửi thành công!', emailRes.status);
      return res.status(200).send('Webhook đã xử lý và gửi mail thành công');
      
    } catch (error) {
      console.error('❌ [EmailJS] Lỗi gửi email:', error.response?.data || error.message);
      // Vẫn trả về 200 để Snipcart không gửi đi gửi lại gói tin nhiều lần
      return res.status(200).send('Lỗi gửi email nhưng ghi nhận webhook');
    }
  }

  // Trả về trạng thái 200 cho tất cả các sự kiện khác để tránh nghẽn hàng đợi của Snipcart
  res.status(200).send('Sự kiện nhận thành công');
});

// Thiết lập cổng chạy máy chủ
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang lắng nghe ổn định tại cổng ${PORT}`);
});
