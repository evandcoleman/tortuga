import Link from 'next/link';

export default function NewsletterIndex() {
  return (
    <div>
      <h2>Newsletter</h2>
      <ul>
        <li>
          <Link href="/newsletter/preview">Preview this week&apos;s digest (dry-run)</Link>
        </li>
        <li>
          <Link href="/newsletter/history">Send history</Link>
        </li>
        <li>
          <Link href="/newsletter/recipients">Recipients</Link>
        </li>
      </ul>
    </div>
  );
}
