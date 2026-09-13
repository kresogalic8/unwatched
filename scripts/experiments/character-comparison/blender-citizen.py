# Editable Blender study: metres, one armature, weighted meshes, facial shape key.
# Run in Blender's Python environment. The optional `artifacts` registry belongs
# to the remote preview worker; ordinary Blender can omit the last render block.
import bpy, math
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.render.fps=24
scene.frame_start=1
scene.frame_end=241

def material(name,color,rough=.8):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough
    return m
skin=material('Warm clay skin',(.57,.31,.19)); shirt=material('Linen cream',(.82,.78,.64)); pants=material('Deep teal trousers',(.12,.24,.23)); hair=material('Chestnut hair',(.13,.067,.039)); sole=material('Leather shoes',(.14,.12,.084)); dark=material('Eyes and brows',(.045,.058,.044)); white=material('Warm eye whites',(.89,.87,.76)); coral=material('Terracotta scarf',(.7,.2,.095)); groundmat=material('Sage stage',(.52,.6,.45))
parts=[]
def ellipsoid(name,loc,scale,mat,bone=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat)
    for f in o.data.polygons:f.use_smooth=True
    if bone:parts.append((o,bone))
    return o

def segment(name,a,b,r,mat,bone):
    midpoint=(Vector(a)+Vector(b))*.5; d=Vector(b)-Vector(a)
    o=ellipsoid(name,midpoint,(r,r,d.length/2+r*.3),mat,bone)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return o

rigdata=bpy.data.armatures.new('Citizen skeleton')
rig=bpy.data.objects.new('CitizenRig',rigdata);scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bones={}
def bone(name,a,b,parent=None):
    eb=rigdata.edit_bones.new(name);eb.head=a;eb.tail=b
    if parent:eb.parent=bones[parent]
    bones[name]=eb
bone('root',(0,0,.88),(0,0,1.02))
bone('spine',(0,0,1.02),(0,0,1.4),'root')
bone('head',(0,0,1.4),(0,0,1.82),'spine')
for side,x in [('L',-.19),('R',.19)]:
    bone('thigh.'+side,(x*.65,0,.92),(x*.65,0,.52),'root')
    bone('shin.'+side,(x*.65,0,.52),(x*.65,0,.12),'thigh.'+side)
    bone('foot.'+side,(x*.65,0,.12),(x*.65,-.16,.08),'shin.'+side)
    ax= -.26 if side=='L' else .26
    ex= -.34 if side=='L' else .34
    hx= -.37 if side=='L' else .37
    bone('upper_arm.'+side,(ax,0,1.35),(ex,0,1.07),'spine')
    bone('forearm.'+side,(ex,0,1.07),(hx,-.025,.83),'upper_arm.'+side)
    bone('hand.'+side,(hx,-.025,.83),(hx,-.025,.74),'forearm.'+side)
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
ellipsoid('Shirt torso',(0,0,1.18),(.235,.135,.285),shirt,'spine')
ellipsoid('Trouser hips',(0,0,.925),(.207,.122,.135),pants,'root')
ellipsoid('Neck',(0,0,1.465),(.073,.07,.115),skin,'head')
ellipsoid('Head',(0,-.008,1.665),(.163,.139,.208),skin,'head')
ellipsoid('Nose',(0,-.153,1.66),(.032,.053,.043),skin,'head')
for x in [-.159,.159]:ellipsoid('Ear',(x,0,1.65),(.025,.033,.055),skin,'head')
# Hair cap at the crown; smaller curls are kept clear of the eyes.
ellipsoid('Hair crown',(0,.025,1.808),(.163,.139,.092),hair,'head')
for i in range(9):
    a=i/9*math.tau
    ellipsoid('Crown curl %02d'%i,(.135*math.cos(a),.025+.106*math.sin(a),1.813),(.049,.044,.043),hair,'head')
ellipsoid('Hair bun',(0,.157,1.76),(.079,.065,.085),hair,'head')
for x in [-.059,.059]:
    ellipsoid('Eye white',(x,-.132,1.699),(.035,.021,.029),white,'head')
    ellipsoid('Pupil',(x,-.151,1.699),(.013,.009,.016),dark,'head')
    ellipsoid('Eye glint',(x-.004,-.16,1.705),(.004,.002,.005),white,'head')
    segment('Eyebrow',(x-.029,-.139,1.743),(x+.026,-.138,1.748),.009,hair,'head')
# A mesh mouth with an actual glTF morph target, controlled independently in Three.js.
verts=[];faces=[]
for i in range(17):
    x=(i/16-.5)*.1
    for k in [-1,1]:verts.append((x,-.145,1.605+k*.004))
for i in range(16):faces.append((2*i,2*i+1,2*i+3,2*i+2))
mesh=bpy.data.meshes.new('Expression mouth mesh');mesh.from_pydata(verts,[],faces);mesh.materials.append(dark)
mouth=bpy.data.objects.new('ExpressionSmile',mesh);scene.collection.objects.link(mouth);parts.append((mouth,'head'))
mouth.shape_key_add(name='Basis');smile=mouth.shape_key_add(name='Smile')
for v in smile.data:v.co.z+=.024*(abs(v.co.x)/.05)**1.7-.006
for side,x in [('L',-.1235),('R',.1235)]:
    segment('Trouser upper '+side,(x,0,.89),(x,0,.53),.087,pants,'thigh.'+side)
    segment('Trouser lower '+side,(x,0,.54),(x,0,.15),.066,pants,'shin.'+side)
    ellipsoid('Shoe '+side,(x,-.062,.082),(.08,.147,.07),sole,'foot.'+side)
    sign=-1 if side=='L' else 1
    segment('Sleeve '+side,(sign*.25,0,1.34),(sign*.335,0,1.075),.079,shirt,'upper_arm.'+side)
    segment('Forearm '+side,(sign*.34,0,1.07),(sign*.37,-.025,.84),.049,skin,'forearm.'+side)
    ellipsoid('Hand '+side,(sign*.37,-.025,.782),(.047,.035,.073),skin,'hand.'+side)
    ellipsoid('Thumb '+side,(sign*.335,-.04,.805),(.024,.025,.036),skin,'hand.'+side)
# Joint volumes keep rigid weighted components visually connected.
for side,sign in [('L',-1),('R',1)]:
    ellipsoid('Knee.'+side,(sign*.1235,0,.52),(.067,.067,.068),pants,'thigh.'+side)
    ellipsoid('Elbow.'+side,(sign*.34,0,1.07),(.049,.049,.049),skin,'upper_arm.'+side)
    ellipsoid('Shoulder.'+side,(sign*.26,0,1.35),(.076,.079,.078),shirt,'spine')
    ellipsoid('Ankle.'+side,(sign*.1235,0,.15),(.048,.048,.052),pants,'shin.'+side)
# Collar, scarf and buttons preserve the island's palette.
ellipsoid('Scarf collar',(0,-.005,1.423),(.107,.095,.043),coral,'spine')
segment('Scarf tail',(.06,-.135,1.405),(.085,-.151,1.215),.024,coral,'spine')
for z in [1.29,1.2,1.11]:ellipsoid('Shirt button',(0,-.135,z),(.01,.006,.01),sole,'spine')
for o,b in parts:
    vg=o.vertex_groups.new(name=b);vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
    mod=o.modifiers.new('Citizen skeleton','ARMATURE');mod.object=rig
    o.parent=rig
# A single baked timeline: idle 1–49, walk 49–145, wave 145–241.
for pb in rig.pose.bones:pb.rotation_mode='XYZ'
for frame in range(1,242,4):
    t=(frame-1)/24
    for pb in rig.pose.bones:pb.rotation_euler=(0,0,0);pb.location=(0,0,0)
    rig.pose.bones['spine'].rotation_euler[2]=.018*math.sin(t*math.tau*.35)
    rig.pose.bones['head'].rotation_euler[2]=.045*math.sin(t*math.tau*.2)
    if 2<=t<=6:
        ramp=min(1,(t-2)*4,(6-t)*4)
        phase=(t-2)*math.tau
        for side,sign in [('L',1),('R',-1)]:
            rig.pose.bones['thigh.'+side].rotation_euler[0]=sign*.4*math.sin(phase)*ramp
            rig.pose.bones['shin.'+side].rotation_euler[0]=max(0,-sign*math.cos(phase))*.55*ramp
            rig.pose.bones['upper_arm.'+side].rotation_euler[0]=-sign*.28*math.sin(phase)*ramp
        rig.pose.bones['root'].location[1]=abs(math.sin(phase))*.022*ramp
    if 6<t<=10:
        ramp=min(1,(t-6)*1.6,(10-t)*1.6);ramp=ramp*ramp*(3-2*ramp)
        rig.pose.bones['upper_arm.R'].rotation_euler[2]=-1.65*ramp
        rig.pose.bones['forearm.R'].rotation_euler[2]=(-.65+.22*math.sin(t*math.tau*1.5))*ramp
        rig.pose.bones['hand.R'].rotation_euler[2]=.2*math.sin(t*math.tau*1.5)*ramp
        rig.pose.bones['head'].rotation_euler[2]=-.12*ramp
    for pb in rig.pose.bones:
        pb.keyframe_insert('rotation_euler',frame=frame,group=pb.name)
        if pb.name=='root':pb.keyframe_insert('location',frame=frame,group=pb.name)
rig.animation_data.action.name='CitizenMotion'
# Studio floor and portable lights. The browser supplies its own orbit camera.
bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=1.15,depth=.08,location=(0,0,-.015))
floor=bpy.context.object;floor.name='Study plinth';floor.data.materials.append(groundmat)
bevel=floor.modifiers.new('Soft edge','BEVEL');bevel.width=.025;bevel.segments=3
for f in floor.data.polygons:f.use_smooth=True
world=bpy.data.worlds.new('Warm ambient');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.72,.62,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55;scene.world=world
for name,loc,power,color in [('Key',(-3,-4,5),750,(1,.9,.76)),('Fill',(3,-1,3),350,(.79,.89,1)),('Rim',(0,3,4),600,(1,.83,.6))]:
    data=bpy.data.lights.new(name,'POINT');data.energy=power;data.color=color;data.shadow_soft_size=1.4
    light=bpy.data.objects.new(name,data);scene.collection.objects.link(light);light.location=loc
camdata=bpy.data.cameras.new('Delivery camera');cam=bpy.data.objects.new('Delivery camera',camdata);scene.collection.objects.link(cam)
cam.location=(3.1,-6.5,2.9);cam.rotation_euler=(Vector((0,0,.97))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=2.9;scene.camera=cam
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
scene.frame_set(181)
result={'objects':len(bpy.data.objects),'bones':len(rigdata.bones),'animation':'CitizenMotion','frames':[1,241],'clips':{'Idle':[0,2],'Walk':[2,6],'Wave':[6,10]},'morph':'Smile'}
if 'artifacts' in globals():
    target=artifacts.file(name='citizen-blender-preview.png',media_type='image/png')
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(target.path)
    bpy.ops.render.render(write_still=True);target.publish()
scene.frame_set(1)
