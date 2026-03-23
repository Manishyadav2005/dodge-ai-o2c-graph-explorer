import './globals.css';

export const metadata = {
  title: 'Dodge AI — Order-to-Cash Graph Explorer',
  description: 'Graph-based data modeling and LLM query system for SAP O2C data',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
