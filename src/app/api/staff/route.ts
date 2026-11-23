import { z } from 'zod';
import { route, parseBody } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { withConn } from '@/lib/db';
import { listEmployees, listUsers } from '@/lib/hotel';

export const GET = route(async () => {
  await requirePerm('staff.manage');
  return { employees: await listEmployees(), users: await listUsers() };
});

// CREATE employee
export const POST = route(async (req) => {
  const s = await requirePerm('staff.manage');
  const b = await parseBody(req, z.object({
    fullName: z.string().trim().min(2).max(100),
    jobTitle: z.string().trim().min(2).max(80),
    departmentId: z.coerce.number().int().positive(),
    managerId: z.coerce.number().int().positive().nullable().optional(),
    hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    salary: z.coerce.number().positive(),
  }));
  await withConn(s.userId, (c) => c.query(
    'INSERT INTO employees (department_id, manager_id, full_name, job_title, hire_date, monthly_salary) VALUES (?,?,?,?,?,?)',
    [b.departmentId, b.managerId ?? null, b.fullName, b.jobTitle, b.hireDate, b.salary]));
  return Response.json({ employees: await listEmployees() }, { status: 201 });
});
