import { ChatInput } from '@/components/app/ChatInput/ChatInput';

export default function Page() {
  return (
    <main className="min-h-screen w-full flex items-end justify-center">
      <section className="w-full max-w-180 px-4 pb-4">
        <ChatInput />
      </section>
    </main>
  );
}
