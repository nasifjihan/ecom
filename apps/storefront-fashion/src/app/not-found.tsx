import { NotFoundContent } from "./not-found-content";

/** Addresses that don't exist (after redirects): a friendly page, and the address is reported. */
export default function NotFound() {
  return <NotFoundContent />;
}
