import { Hono } from 'hono';
import { db } from '@nexus/db';
import { authMiddleware, ORG_ADMIN_ONLY, BRANCH_MANAGER_AND_ABOVE } from '@nexus/auth';
import { successResponse, errorResponse } from '@nexus/types';
import { verifyAccessToken } from '@nexus/auth';

export const categoryRouter = new Hono();

categoryRouter.use('*', authMiddleware);

categoryRouter.get('/', BRANCH_MANAGER_AND_ABOVE, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const categories = await db.category.findMany({
      where: { organisationId: user.organisationId },
      include: {
        _count: { select: { products: true } },
        children: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return c.json(successResponse(categories));
  } catch (error) {
    console.error('Get categories error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to get categories'), 500);
  }
});

categoryRouter.post('/', ORG_ADMIN_ONLY, async (c) => {
  try {
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { name, description, parentId } = body;

    if (!name) {
      return c.json(errorResponse('Validation Error', 'Name is required'), 400);
    }

    if (parentId) {
      const parent = await db.category.findFirst({
        where: { id: parentId, organisationId: user.organisationId },
      });
      if (!parent) {
        return c.json(errorResponse('Not Found', 'Parent category not found'), 404);
      }
    }

    const category = await db.category.create({
      data: {
        name,
        description,
        parentId,
        organisationId: user.organisationId,
      },
    });

    return c.json(successResponse(category, 'Category created successfully'), 201);
  } catch (error) {
    console.error('Create category error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to create category'), 500);
  }
});

categoryRouter.put('/:id', ORG_ADMIN_ONLY, async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const body = await c.req.json();
    const { name, description } = body;

    const category = await db.category.findFirst({
      where: { id, organisationId: user.organisationId },
    });

    if (!category) {
      return c.json(errorResponse('Not Found', 'Category not found'), 404);
    }

    const updated = await db.category.update({
      where: { id },
      data: { ...(name && { name }), ...(description !== undefined && { description }) },
    });

    return c.json(successResponse(updated, 'Category updated successfully'));
  } catch (error) {
    console.error('Update category error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to update category'), 500);
  }
});

categoryRouter.delete('/:id', ORG_ADMIN_ONLY, async (c) => {
  try {
    const id = c.req.param('id');
    const authHeader = c.req.header('Authorization')!;
    const token = authHeader.slice(7);
    const user = verifyAccessToken(token);

    const category = await db.category.findFirst({
      where: { id, organisationId: user.organisationId },
    });

    if (!category) {
      return c.json(errorResponse('Not Found', 'Category not found'), 404);
    }

    await db.category.delete({ where: { id } });

    return c.json(successResponse({ message: 'Category deleted' }));
  } catch (error) {
    console.error('Delete category error:', error);
    return c.json(errorResponse('Internal Server Error', 'Failed to delete category'), 500);
  }
});