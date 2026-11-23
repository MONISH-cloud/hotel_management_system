import { z } from 'zod';
import { route, parseBody, ApiError } from '@/lib/api';
import { requirePerm } from '@/lib/auth';
import { withConn } from '@/lib/db';
import { listEmployees } from '@/lib/hotel';

type Ctx = { params: Promise<{ id: string }> };

// UPDATE employee (the trg_emp_bu trigger forbids "own manager")
export const PATCH = route<Ctx>(async (req, { params }) => {
  const s = await requirePerm('staff.manage');
  const id = Number((await params).id);
  const b = await parseBody(req, z.object({
    jobTitle: z.string().trim().min(2).max(80).optional(),
    salary: z.coerce.number().positive().optional(),
    managerId: z.coerce.number().int().positive().nullable().optional(),
  }));
  const sets: string[] = [], vals: unknown[] = [];
  if (b.jobTitle) { sets.push('job_title = ?'); vals.push(b.jobTitle); }
  if (b.salary) { sets.push('monthly_salary = ?'); vals.push(b.salary); }
  if (b.managerId !== undefined) { sets.push('manager_id = ?'); vals.push(b.managerId); }
  if (!sets.length) throw new ApiError(400, 'Nothing to update');
  await withConn(s.userId, (c) => c.query(`UPDATE employees SET ${sets.join(', ')} WHERE employee_id = ?`, [...vals, id]));
  return { employees: await listEmployees() };
});

// DELETE employee (direct reports are re-parented by FK ON DELETE SET NULL)
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const s = await requirePerm('staff.manage');
  const id = Number((await params).id);
  await withConn(s.userId, (c) => c.query('DELETE FROM employees WHERE employee_id = ?', [id]));
  return { employees: await listEmployees() };
});
