"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/") ? next : "/";
    } else {
      setError("邮箱或密码错误");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label>
        邮箱
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
        />
      </label>
      <label>
        密码
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit">登录</button>
    </form>
  );
}
