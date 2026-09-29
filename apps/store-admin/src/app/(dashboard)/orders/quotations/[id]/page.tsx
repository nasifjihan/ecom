"use client";

import { useParams } from "next/navigation";
import { QuoteEditor } from "@/components/orders/quote-editor";

export default function QuotationPage() {
  const { id } = useParams<{ id: string }>();
  return <QuoteEditor key={id} id={id} />;
}
