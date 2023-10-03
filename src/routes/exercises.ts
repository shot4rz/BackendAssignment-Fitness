import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { z } from 'zod'
import { isAdmin, isAuthenticated } from '../middleware/auth'
import { ExerciseDifficulty } from '@prisma/client'

const router: Router = Router()

const createSchema = z.object({
	name: z.string(),
	difficulty: z.nativeEnum(ExerciseDifficulty),
	programs: z.array(z.number().int()).optional()
})

const updateSchema = z.object({
	name: z.string().optional(),
	difficulty: z.nativeEnum(ExerciseDifficulty).optional(),
	programs: z.array(z.number().int()).optional()
})

export default () => {
	router.get('/', async (_req: Request, res: Response, _next: NextFunction) => {
		const exercises = await prisma.exercise.findMany({ include: { programs: true } })

		return res.json({
			data: exercises,
			message: 'List of exercises'
		})
	})

	router.post('/', isAuthenticated, isAdmin, async (req: Request, res: Response, _next: NextFunction) => {
		let parsedData: z.infer<typeof createSchema>
		try {
			parsedData = createSchema.parse(req.body)
		} catch (error) {
			return res.status(400).json({
				message: "Validation error",
				errors: error.errors
			})
		}

		if (parsedData.programs) {
			for (const id of parsedData.programs) {
				const existingProgram = await prisma.program.findUnique({ where: { id } })
				if (!existingProgram) {
					return res.status(404).json({
						id,
						message: "Program not found"
					})
				}
			}
		}

		const programsToConnect = parsedData.programs && parsedData.programs.map((id) => { return { id } })
		const exercise = await prisma.exercise.create({
			data: {
				...parsedData,
				programs: {
					connect: programsToConnect
				}
			}
		})

		return res.status(201).json({
			exercise,
			message: 'Exercise created'
		})
	})

	router.put('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, _next: NextFunction) => {
		const id = parseInt(req.params.id)
		if (isNaN(id)) {
			return res.status(400).json({
				message: "Invalid exercise ID"
			})
		}

		// including the related programs aswell so they can be removed if needed
		const existingExercise = await prisma.exercise.findUnique({
			where: { id },
			include: { programs: true }
		})
		if (!existingExercise) {
			return res.status(404).json({
				id,
				message: "Exercise not found"
			})
		}

		let parsedData: z.infer<typeof updateSchema>
		try {
			parsedData = updateSchema.parse(req.body)
		} catch (error) {
			return res.status(400).json({
				message: "Validation error",
				errors: error.errors
			})
		}

		if (parsedData.programs) {
			for (const id of parsedData.programs) {
				const existingProgram = await prisma.program.findUnique({ where: { id } })
				if (!existingProgram) {
					return res.status(404).json({
						id,
						message: "Program not found"
					})
				}
			}
		}

		// disconnecting all the existing exercise program relations if a programs property was passed
		if (parsedData.hasOwnProperty('programs')) {
			const currentlyConnectedPrograms = existingExercise.programs.map((program) => { return { id: program.id } })
			await prisma.exercise.update({
				where: { id },
				data: {
					programs: {
						disconnect: currentlyConnectedPrograms
					}
				}
			})
		}

		const programsToConnect = parsedData.programs && parsedData.programs.map((id) => { return { id } })
		const exercise = await prisma.exercise.update({
			where: { id },
			data: {
				...parsedData,
				programs: {
					connect: programsToConnect
				}
			}
		})

		return res.json({
			exercise,
			message: 'Exercise updated'
		})
	})

	router.delete('/:id', isAuthenticated, isAdmin, async (req: Request, res: Response, _next: NextFunction) => {
		const id = parseInt(req.params.id)
		if (isNaN(id)) {
			return res.status(400).json({
				message: "Invalid exercise ID"
			})
		}

		const existingExercise = await prisma.exercise.findUnique({ where: { id } })
		if (!existingExercise) {
			return res.status(404).json({
				id,
				message: "Exercise not found"
			})
		}

		await prisma.exercise.delete({ where: { id } })

		return res.json({
			id,
			message: 'Exercise deleted'
		})
	})

	return router
}
