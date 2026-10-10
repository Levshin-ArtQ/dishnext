export function FoodDecor() {
  return (
    <div className="food-decor" aria-hidden="true">
      <svg className="deco tomato" viewBox="0 0 120 120">
        <ellipse cx="62" cy="70" rx="42" ry="38" fill="#ef7a6a" />
        <ellipse cx="48" cy="58" rx="14" ry="10" fill="#f49a8d" opacity=".55" />
        <path d="M62 28c6 8 8 16 2 22-8-4-16-4-22 2 2-10 8-18 20-24z" fill="#5f8a68" />
        <path d="M62 28c-4 10 2 16 10 18-2-8-2-14-10-18z" fill="#3f6b4c" />
      </svg>
      <svg className="deco carrot" viewBox="0 0 90 180">
        <path d="M46 48c18 38 18 78 4 118-18-6-30-20-34-48 8-24 18-48 30-70z" fill="#ef7a6a" />
        <path d="M38 42c-10-18-22-28-30-30 14 2 24 8 32 20 2-12-4-24-14-32 18 6 28 22 12 42z" fill="#5f8a68" />
        <path d="M42 40c8-16 20-26 32-28-16 6-24 16-28 30 10-4 22-6 30-2-14 4-26 8-34 0z" fill="#3f6b4c" />
      </svg>
      <svg className="deco leaf leaf-a" viewBox="0 0 80 100">
        <path d="M12 88c28-6 52-32 56-72-28 8-50 28-56 72z" fill="#f4b4a8" />
        <path d="M20 80c16-10 32-28 38-48" fill="none" stroke="#e0897a" strokeWidth="2" />
      </svg>
      <svg className="deco leaf leaf-b" viewBox="0 0 90 110">
        <path d="M70 18c-8 28-28 52-62 62 10-30 30-54 62-62z" fill="#f7cfc4" />
        <path d="M62 28c-10 16-26 34-48 44" fill="none" stroke="#e8a090" strokeWidth="2" />
      </svg>
    </div>
  );
}
