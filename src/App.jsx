import { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "";

async function extractErrorMessage(res) {
  try {
    const body = await res.json();
    const d = body?.detail;
    if (!d) return body?.message || "Request failed";
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      // FastAPI validation errors array
      return d.map((e) => e?.msg || JSON.stringify(e)).join("; ");
    }
    if (typeof d === "object") return d.message || JSON.stringify(d);
    return "Request failed";
  } catch (e) {
    return `Request failed (${res.status})`;
  }
}

function useAuth() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  });

  const login = (t, u) => {
    setToken(t);
    setUser(u);
    localStorage.setItem("token", t);
    localStorage.setItem("user", JSON.stringify(u));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return { token, user, login, logout };
}

function Header({ user, onLogout }) {
  if (!user) return null;
  return (
    <div className="w-full flex items-center justify-between p-4 bg-white border-b">
      <div className="font-semibold">Logged in as {user.name} ({user.role})</div>
      <button onClick={onLogout} className="px-3 py-2 rounded bg-gray-800 text-white">Logout</button>
    </div>
  );
}

function Login({ onLogin, switchToSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      const data = await res.json();
      onLogin(data.access_token, data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-md w-full bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Login</h2>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border p-2 rounded" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="Password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        <button className="w-full bg-blue-600 text-white py-2 rounded">Login</button>
      </form>
      <div className="text-sm mt-3">No account? <button className="text-blue-700" onClick={switchToSignup}>Sign up</button></div>
    </div>
  );
}

function Signup({ onLogin, switchToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, address, password }),
      });
      if (!res.ok) throw new Error(await extractErrorMessage(res));
      const body = await res.json();
      onLogin(body.access_token, body.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-md w-full bg-white p-6 rounded shadow">
      <h2 className="text-xl font-semibold mb-4">Sign up</h2>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border p-2 rounded" placeholder="Full name (20-60 chars)" value={name} onChange={(e)=>setName(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="Address (max 400 chars)" value={address} onChange={(e)=>setAddress(e.target.value)} />
        <input className="w-full border p-2 rounded" placeholder="Password (8-16, 1 uppercase & 1 special)" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} />
        <button className="w-full bg-blue-600 text-white py-2 rounded">Create account</button>
      </form>
      <div className="text-sm mt-3">Already have an account? <button className="text-blue-700" onClick={switchToLogin}>Login</button></div>
    </div>
  );
}

function ChangePassword({ token }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    const res = await fetch(`${API_BASE}/auth/password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
    });
    if (res.ok) {
      setMsg("Password updated");
    } else {
      setMsg(await extractErrorMessage(res));
    }
  };
  return (
    <form onSubmit={submit} className="flex gap-2 items-end flex-wrap">
      <div>
        <label className="block text-sm">Old password</label>
        <input className="border p-2 rounded" type="password" value={oldPassword} onChange={(e)=>setOldPassword(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm">New password</label>
        <input className="border p-2 rounded" type="password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} />
      </div>
      <button className="bg-gray-900 text-white px-3 py-2 rounded">Update</button>
      {msg && <div className="text-sm ml-2">{msg}</div>}
    </form>
  );
}

function AdminView({ token }) {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [filters, setFilters] = useState({ name: "", email: "", address: "", role: "" });
  const [sort, setSort] = useState({ by: "name", order: "asc" });

  const fetchStats = async () => {
    const r = await fetch(`${API_BASE}/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setStats(await r.json());
  };

  const fetchUsers = async () => {
    const params = new URLSearchParams({ ...filters, sort_by: sort.by, order: sort.order });
    const r = await fetch(`${API_BASE}/admin/users?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setUsers(await r.json());
  };

  const fetchStores = async () => {
    const params = new URLSearchParams({ name: filters.name, email: filters.email, address: filters.address, sort_by: sort.by, order: sort.order });
    const r = await fetch(`${API_BASE}/admin/stores?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setStores(await r.json());
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchUsers(); fetchStores(); }, [JSON.stringify(filters), JSON.stringify(sort)]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded shadow"><div className="text-sm">Total Users</div><div className="text-2xl font-semibold">{stats?.total_users ?? '-'}</div></div>
        <div className="p-4 bg-white rounded shadow"><div className="text-sm">Total Stores</div><div className="text-2xl font-semibold">{stats?.total_stores ?? '-'}</div></div>
        <div className="p-4 bg-white rounded shadow"><div className="text-sm">Total Ratings</div><div className="text-2xl font-semibold">{stats?.total_ratings ?? '-'}</div></div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <h3 className="font-semibold mb-2">Filters</h3>
        <div className="flex flex-wrap gap-2">
          <input className="border p-2 rounded" placeholder="Name" value={filters.name} onChange={(e)=>setFilters(f=>({...f,name:e.target.value}))} />
          <input className="border p-2 rounded" placeholder="Email" value={filters.email} onChange={(e)=>setFilters(f=>({...f,email:e.target.value}))} />
          <input className="border p-2 rounded" placeholder="Address" value={filters.address} onChange={(e)=>setFilters(f=>({...f,address:e.target.value}))} />
          <select className="border p-2 rounded" value={filters.role} onChange={(e)=>setFilters(f=>({...f,role:e.target.value}))}>
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
            <option value="owner">Owner</option>
          </select>
          <select className="border p-2 rounded" value={sort.by} onChange={(e)=>setSort(s=>({...s,by:e.target.value}))}>
            <option value="name">Name</option>
            <option value="email">Email</option>
            <option value="address">Address</option>
            <option value="role">Role</option>
          </select>
          <select className="border p-2 rounded" value={sort.order} onChange={(e)=>setSort(s=>({...s,order:e.target.value}))}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow overflow-auto">
        <h3 className="font-semibold mb-2">Users</h3>
        <table className="min-w-full text-sm">
          <thead><tr className="text-left"><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Address</th><th className="p-2">Role</th></tr></thead>
          <tbody>
            {users.map(u=> (
              <tr key={u.id} className="border-t"><td className="p-2">{u.name}</td><td className="p-2">{u.email}</td><td className="p-2">{u.address}</td><td className="p-2">{u.role}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-4 rounded shadow overflow-auto">
        <h3 className="font-semibold mb-2">Stores</h3>
        <table className="min-w-full text-sm">
          <thead><tr className="text-left"><th className="p-2">Name</th><th className="p-2">Email</th><th className="p-2">Address</th><th className="p-2">Average Rating</th><th className="p-2">Ratings Count</th></tr></thead>
          <tbody>
            {stores.map(s=> (
              <tr key={s.id} className="border-t"><td className="p-2">{s.name}</td><td className="p-2">{s.email}</td><td className="p-2">{s.address}</td><td className="p-2">{s.average_rating ?? '-'}</td><td className="p-2">{s.rating_count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StoresList({ token }) {
  const [stores, setStores] = useState([]);
  const [filters, setFilters] = useState({ name: "", address: "" });
  const [sort, setSort] = useState({ by: "name", order: "asc" });

  const fetchStores = async () => {
    const params = new URLSearchParams({ ...filters, sort_by: sort.by, order: sort.order });
    const r = await fetch(`${API_BASE}/stores?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setStores(await r.json());
  };

  useEffect(() => { fetchStores(); }, [JSON.stringify(filters), JSON.stringify(sort)]);

  const rate = async (id, score) => {
    const r = await fetch(`${API_BASE}/stores/${id}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ score })
    });
    if (r.ok) fetchStores();
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded shadow flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-sm">Name</label>
          <input className="border p-2 rounded" value={filters.name} onChange={(e)=>setFilters(f=>({...f,name:e.target.value}))} />
        </div>
        <div>
          <label className="block text-sm">Address</label>
          <input className="border p-2 rounded" value={filters.address} onChange={(e)=>setFilters(f=>({...f,address:e.target.value}))} />
        </div>
        <div>
          <label className="block text-sm">Sort by</label>
          <select className="border p-2 rounded" value={sort.by} onChange={(e)=>setSort(s=>({...s,by:e.target.value}))}>
            <option value="name">Name</option>
            <option value="address">Address</option>
          </select>
        </div>
        <div>
          <label className="block text-sm">Order</label>
          <select className="border p-2 rounded" value={sort.order} onChange={(e)=>setSort(s=>({...s,order:e.target.value}))}>
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3">
        {stores.map(s => (
          <div key={s.id} className="bg-white p-4 rounded shadow flex items-center justify-between">
            <div>
              <div className="font-semibold">{s.name}</div>
              <div className="text-sm text-gray-600">{s.address}</div>
              <div className="text-sm mt-1">Overall Rating: {s.overall_rating ?? '-'}</div>
              <div className="text-sm">Your Rating: {s.my_rating ?? '-'}</div>
            </div>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={()=>rate(s.id, n)} className={`w-8 h-8 rounded-full border ${s.my_rating >= n ? 'bg-yellow-400' : 'bg-white'}`}>{n}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnerDashboard({ token }) {
  const [data, setData] = useState([]);
  const load = async () => {
    const r = await fetch(`${API_BASE}/owner/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setData(await r.json());
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-4">
      {data.map(block => (
        <div key={block.store.id} className="bg-white p-4 rounded shadow">
          <div className="font-semibold mb-2">{block.store.name}</div>
          <div className="text-sm mb-3">Average Rating: {block.average_rating ?? '-'}</div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="text-left"><th className="p-2">User</th><th className="p-2">Email</th><th className="p-2">Score</th></tr></thead>
              <tbody>
                {block.ratings.map((r, i) => (
                  <tr key={i} className="border-t"><td className="p-2">{r.user_name}</td><td className="p-2">{r.user_email}</td><td className="p-2">{r.score}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const { token, user, login, logout } = useAuth();
  const [mode, setMode] = useState("login");

  useEffect(() => {
    if (user) setMode("home");
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} onLogout={logout} />
      <div className="max-w-5xl mx-auto p-4">
        {!user && (
          <div className="flex items-center justify-center py-24">
            {mode === "login" ? (
              <Login onLogin={login} switchToSignup={() => setMode("signup")} />
            ) : (
              <Signup onLogin={login} switchToLogin={() => setMode("login")} />
            )}
          </div>
        )}

        {user && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded shadow">
              <h2 className="text-lg font-semibold mb-2">Welcome</h2>
              <ChangePassword token={token} />
            </div>

            {user.role === "admin" && <AdminView token={token} />}
            {user.role === "user" && <StoresList token={token} />}
            {user.role === "owner" && <OwnerDashboard token={token} />}
          </div>
        )}
      </div>
    </div>
  );
}
