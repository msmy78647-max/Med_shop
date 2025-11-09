import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createOrder, updateOrderStatus } from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  orders: router({
    create: publicProcedure
      .input(
        z.object({
          customerName: z.string().min(1),
          customerAddress: z.string().min(1),
          customerCity: z.string().min(1),
          productName: z.string().min(1),
          color: z.string().min(1),
          size: z.string().min(1),
          price: z.number().int().positive(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const result = await createOrder({
            customerName: input.customerName,
            customerAddress: input.customerAddress,
            customerCity: input.customerCity,
            productName: input.productName,
            color: input.color,
            size: input.size,
            price: input.price,
            status: "pending",
          });

          const telegramToken = "8387473741:AAGHOI-oS7HXYFPSKfBmzotZ2PGCGNxhJiU";
          const telegramChatId = "6781508116";

          const message = `🛍️ طلب جديد من صفحة الهبوط

👤 الاسم: ${input.customerName}
📍 العنوان: ${input.customerAddress}
🏙️ المدينة: ${input.customerCity}

📦 المنتج: ${input.productName}
🎨 اللون: ${input.color}
📏 المقاس: ${input.size}
💰 السعر: ${input.price} درهم

✅ تم الإرسال بنجاح`;

          const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
          const response = await fetch(telegramUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: message,
              parse_mode: "HTML",
            }),
          });

          if (response.ok) {
            const orderId = result && "insertId" in result ? (result.insertId as number) : 0;
            if (orderId > 0) {
              await updateOrderStatus(orderId, "sent_to_telegram");
            }
            return {
              success: true,
              orderId: orderId,
              message: "تم إرسال الطلب بنجاح",
            };
          } else {
            throw new Error("Failed to send message to Telegram");
          }
        } catch (error) {
          console.error("Error creating order:", error);
          throw error;
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
