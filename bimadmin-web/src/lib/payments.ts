import { supabase } from "./supabaseClient";

// amountKes is intentionally absent. The server derives the charge from
// the plan and the current rate; accepting it here let a caller name their
// own price.
export async function startMpesaPayment(input: { organizationId: string; planId: string; phone: string }) {
  const { data, error } = await supabase.functions.invoke("mpesa-stk-push", { body: input });
  if (error) return { error: error.message, paymentId: null as string | null };
  if (data?.error) return { error: data.error as string, paymentId: null as string | null };
  return { error: null, paymentId: data.paymentId as string };
}

export async function startPaystackPayment(input: { organizationId: string; planId: string; email: string }) {
  const { data, error } = await supabase.functions.invoke("paystack-initialize", { body: input });
  if (error) return { error: error.message, authorizationUrl: null as string | null };
  if (data?.error) return { error: data.error as string, authorizationUrl: null as string | null };
  return { error: null, authorizationUrl: data.authorizationUrl as string };
}

/** Polls the payments table until the STK push either succeeds, fails, or
 * the timeout elapses (the customer took too long to enter their PIN). */
export async function pollPaymentStatus(paymentId: string, timeoutMs = 60000): Promise<"success" | "failed" | "timeout"> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase.from("payments").select("status").eq("id", paymentId).single();
    if (data?.status === "success") return "success";
    if (data?.status === "failed") return "failed";
    await new Promise((r) => setTimeout(r, 2500));
  }
  return "timeout";
}
