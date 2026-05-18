# Error Troubleshooting Guide

## 1. "A listener indicated an asynchronous response by returning true..."

### Penyebab
Error ini biasanya berasal dari:
- Chrome Extensions yang tidak properly handle async responses
- Service Worker yang menunggu response tapi connection ditutup
- Browser background scripts

### Solusi

**Opsi 1: Disable Browser Extensions (Cepat)**
1. Buka Chrome DevTools (F12)
2. Buka Chrome Extensions (chrome://extensions/)
3. Disable semua extensions sementara
4. Refresh halaman dan test

**Opsi 2: Clear Service Worker Cache**
1. Buka DevTools → Application tab
2. Klik "Service Workers"
3. Klik "Unregister" untuk semua service workers
4. Refresh halaman

**Opsi 3: Incognito Mode**
- Buka halaman di Incognito mode (Ctrl+Shift+N)
- Ini disable semua extensions dan service workers
- Jika error hilang, berarti masalah dari extension/cache

### Kesimpulan
Error ini **BUKAN masalah aplikasi Anda**, tapi dari browser/extension. Aman untuk diabaikan.

---

## 2. "Failed to load resource: the server responded with a status of 500"

### Penyebab
API endpoint `/api/modules/submit` mengalami error server. Kemungkinan:
- Database connection error
- Validation error
- Clerk authentication error
- Transaction error

### Debugging Steps

**Step 1: Check Server Logs**
```bash
# Jika running locally dengan npm run dev
# Lihat terminal output untuk error messages
```

**Step 2: Check Browser Console**
1. Buka DevTools (F12)
2. Lihat Network tab
3. Klik request ke `/api/modules/submit`
4. Lihat Response tab untuk error details

**Step 3: Common Issues & Fixes**

#### Issue A: User not found in database
```
Error: User profile not synced
```
**Fix:**
- User sudah login di Clerk tapi belum di database
- Refresh halaman atau logout-login lagi
- Atau jalankan webhook sync manual

#### Issue B: Invalid URL format
```
Error: Invalid data - contentUrl must be valid URL
```
**Fix:**
- Pastikan URL file valid dan dimulai dengan `https://`
- Jangan gunakan URL lokal atau relative paths
- Test URL di browser untuk pastikan accessible

#### Issue C: Database transaction error
```
Error: Internal Server Error
```
**Fix:**
- Check database connection di `.env.local`
- Pastikan `DATABASE_URL` valid
- Restart development server

### Solusi Lengkap

**Untuk Development:**
```bash
# 1. Check environment variables
cat .env.local

# 2. Restart dev server
npm run dev

# 3. Clear browser cache
# DevTools → Application → Clear Storage → Clear All

# 4. Test dengan curl
curl -X POST http://localhost:3000/api/modules/submit \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Module",
    "subject": "Matematika",
    "grade": "XI",
    "category": "Ringkasan",
    "contentUrl": "https://drive.google.com/file/d/test/view"
  }'
```

**Untuk Production:**
- Check server logs: `vercel logs` atau platform logs
- Check database status
- Verify Clerk API keys
- Check CORS settings

---

## 3. "Clerk: Clerk has been loaded with development keys"

### Penyebab
Aplikasi menggunakan Clerk development keys (publishable key dimulai dengan `pk_test_`)

### Solusi

**Untuk Development (OK):**
- Development keys diperbolehkan saat development
- Hanya warning, tidak error
- Bisa diabaikan

**Untuk Production (HARUS DIPERBAIKI):**
1. Buka Clerk Dashboard
2. Ambil production keys
3. Update `.env.local` atau environment variables:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx
```
4. Redeploy aplikasi

---

## 4. "[DEPRECATED] Default export is deprecated. Instead use `import { create } from 'zustand'`"

### Penyebab
Zustand library menggunakan default export yang deprecated

### Solusi

**Cari file yang menggunakan Zustand:**
```bash
grep -r "import.*from.*zustand" src/
```

**Update imports:**
```typescript
// ❌ Old (Deprecated)
import create from 'zustand';

// ✅ New
import { create } from 'zustand';
```

**Jika tidak ada Zustand di project:**
- Ini mungkin dari dependency lain
- Bisa diabaikan atau update dependencies:
```bash
npm update zustand
```

---

## Quick Checklist

- [ ] Disable browser extensions dan test
- [ ] Clear service workers
- [ ] Check `.env.local` variables
- [ ] Verify database connection
- [ ] Check Clerk authentication
- [ ] Test API endpoint dengan curl
- [ ] Check browser console for detailed errors
- [ ] Restart development server
- [ ] Clear browser cache

---

## Still Having Issues?

### Gather Information
1. Screenshot dari error message
2. Network tab request/response
3. Browser console full error
4. `.env.local` (tanpa sensitive values)
5. Server logs output

### Common Commands
```bash
# Check Node version
node --version

# Check npm packages
npm list

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Run with debug mode
DEBUG=* npm run dev

# Check port availability
lsof -i :3000
```

### Contact Support
- Clerk: https://clerk.com/support
- Next.js: https://github.com/vercel/next.js/discussions
- Neon DB: https://neon.tech/docs/introduction
