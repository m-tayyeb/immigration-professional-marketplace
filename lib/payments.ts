import { prisma } from "./prisma";

export interface PaymentGateway {
  markPaid(paymentRequestId: string): Promise<void>;
}

// Development adapter. Replace this implementation with the final provider and webhook later.
export const paymentGateway: PaymentGateway = {
  async markPaid(paymentRequestId) {
    await prisma.paymentRequest.update({
      where: { id: paymentRequestId },
      data: { status: "PAID", paidAt: new Date(), providerReference: `mock_${paymentRequestId}` },
    });
  },
};
