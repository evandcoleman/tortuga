import { redirect } from 'next/navigation';

export default function NewsletterIndex() {
  redirect('/newsletter/preview');
}
