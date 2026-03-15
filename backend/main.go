package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ─────────────────────────────────────
// 📋 Structs
// ─────────────────────────────────────

type Task struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title       string             `bson:"title" json:"title"`
	Description string             `bson:"description" json:"description"`
	Status      string             `bson:"status" json:"status"`         // "todo", "inprogress", "done"
	Priority    string             `bson:"priority" json:"priority"`     // "low", "medium", "high"
	AssignedTo  string             `bson:"assignedTo" json:"assignedTo"` // member name
	DueDate     string             `bson:"dueDate" json:"dueDate"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
}

type Project struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name        string             `bson:"name" json:"name"`
	Description string             `bson:"description" json:"description"`
	Deadline    string             `bson:"deadline" json:"deadline"`
	Members     []string           `bson:"members" json:"members"`
	Tasks       []Task             `bson:"tasks" json:"tasks"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
}

// ─────────────────────────────────────
// 🌍 Global variables
// ─────────────────────────────────────
var projectsCollection *mongo.Collection

// ─────────────────────────────────────
// 🚀 Main
// ─────────────────────────────────────
func main() {
	godotenv.Load()
	connectDB()

	r := gin.Default()

	// CORS
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Project routes
	r.POST("/projects", createProjectHandler)
	r.GET("/projects", getProjectsHandler)
	r.GET("/projects/:id", getProjectHandler)
	r.DELETE("/projects/:id", deleteProjectHandler)

	// Task routes
	r.POST("/projects/:id/tasks", createTaskHandler)
	r.PUT("/projects/:id/tasks/:taskId", updateTaskHandler)
	r.DELETE("/projects/:id/tasks/:taskId", deleteTaskHandler)

	// Member routes
	r.POST("/projects/:id/members", addMemberHandler)
	r.DELETE("/projects/:id/members/:member", removeMemberHandler)

	fmt.Println("🚀 TaskFlow server running on http://localhost:3001")
	r.Run(":3001")
}

// ─────────────────────────────────────
// 🔌 Connect to MongoDB
// ─────────────────────────────────────
func connectDB() {
	uri := os.Getenv("MONGO_URI")
	if uri == "" {
		uri = "mongodb://localhost:27017"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		panic(err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		panic("MongoDB not reachable!")
	}

	projectsCollection = client.Database("taskflow").Collection("projects")
	fmt.Println("✅ Connected to MongoDB!")
}

// ─────────────────────────────────────
// 📡 Project Handlers
// ─────────────────────────────────────

// POST /projects
func createProjectHandler(c *gin.Context) {
	var project Project
	if err := c.ShouldBindJSON(&project); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	project.ID = primitive.NewObjectID()
	project.Tasks = []Task{}
	project.Members = []string{}
	project.CreatedAt = time.Now()

	_, err := projectsCollection.InsertOne(context.Background(), project)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create project"})
		return
	}

	c.JSON(http.StatusOK, project)
}

// GET /projects
func getProjectsHandler(c *gin.Context) {
	opts := options.Find().SetSort(bson.M{"createdAt": -1})
	cursor, err := projectsCollection.Find(context.Background(), bson.M{}, opts)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch projects"})
		return
	}
	defer cursor.Close(context.Background())

	var projects []Project
	cursor.All(context.Background(), &projects)

	if projects == nil {
		projects = []Project{}
	}

	c.JSON(http.StatusOK, projects)
}

// GET /projects/:id
func getProjectHandler(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var project Project
	err = projectsCollection.FindOne(context.Background(), bson.M{"_id": id}).Decode(&project)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}

	c.JSON(http.StatusOK, project)
}

// DELETE /projects/:id
func deleteProjectHandler(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	projectsCollection.DeleteOne(context.Background(), bson.M{"_id": id})
	c.JSON(http.StatusOK, gin.H{"message": "project deleted"})
}

// ─────────────────────────────────────
// 📌 Task Handlers
// ─────────────────────────────────────

// POST /projects/:id/tasks
func createTaskHandler(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var task Task
	if err := c.ShouldBindJSON(&task); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	task.ID = primitive.NewObjectID()
	task.CreatedAt = time.Now()
	if task.Status == "" {
		task.Status = "todo"
	}
	if task.Priority == "" {
		task.Priority = "medium"
	}

	_, err = projectsCollection.UpdateOne(
		context.Background(),
		bson.M{"_id": id},
		bson.M{"$push": bson.M{"tasks": task}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add task"})
		return
	}

	c.JSON(http.StatusOK, task)
}

// PUT /projects/:id/tasks/:taskId
func updateTaskHandler(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	taskId, err := primitive.ObjectIDFromHex(c.Param("taskId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	setFields := bson.M{}
	for key, value := range updates {
		setFields["tasks.$."+key] = value
	}

	_, err = projectsCollection.UpdateOne(
		context.Background(),
		bson.M{"_id": id, "tasks._id": taskId},
		bson.M{"$set": setFields},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task updated"})
}

// DELETE /projects/:id/tasks/:taskId
func deleteTaskHandler(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	taskId, err := primitive.ObjectIDFromHex(c.Param("taskId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
		return
	}

	_, err = projectsCollection.UpdateOne(
		context.Background(),
		bson.M{"_id": id},
		bson.M{"$pull": bson.M{"tasks": bson.M{"_id": taskId}}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete task"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "task deleted"})
}

// ─────────────────────────────────────
// 👥 Member Handlers
// ─────────────────────────────────────

// POST /projects/:id/members
func addMemberHandler(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	var body struct {
		Member string `json:"member"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Member == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "member name required"})
		return
	}

	_, err = projectsCollection.UpdateOne(
		context.Background(),
		bson.M{"_id": id},
		bson.M{"$addToSet": bson.M{"members": body.Member}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "member added"})
}

// DELETE /projects/:id/members/:member
func removeMemberHandler(c *gin.Context) {
	id, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	member := c.Param("member")

	_, err = projectsCollection.UpdateOne(
		context.Background(),
		bson.M{"_id": id},
		bson.M{"$pull": bson.M{"members": member}},
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "member removed"})
}