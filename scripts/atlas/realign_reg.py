# Rigid registration of a head CT/MR to the MNI ICBM152 2009c T1 template (mutual information), so the volume can be resliced
# into true anatomical axial/coronal/sagittal planes. Usage: python3 realign_reg.py <image.nii.gz> <out.tfm> [ct|mr]
import SimpleITK as sitk, numpy as np, sys
src=sys.argv[1]; out=sys.argv[2]; mod=sys.argv[3] if len(sys.argv)>3 else 'ct'
M='/tmp/claude-0/brain/mni/mni_icbm152_nlin_sym_09c/'
fix=sitk.ReadImage(M+'mni_icbm152_t1_tal_nlin_sym_09c.nii',sitk.sitkFloat32)
fmask=sitk.ReadImage(M+'mni_icbm152_t1_tal_nlin_sym_09c_mask.nii',sitk.sitkFloat32)
fix=fix*fmask
mov=sitk.ReadImage(src,sitk.sitkFloat32)
if mod=='ct':
    a=sitk.GetArrayFromImage(mov)
    b=np.where((a>0)&(a<90),a,0).astype(np.float32)   # brain window; bone/air/contrast removed
    m=sitk.GetImageFromArray(b);m.CopyInformation(mov);mov2=sitk.SmoothingRecursiveGaussian(m,1.0)
else:
    mov2=sitk.SmoothingRecursiveGaussian(mov,0.6)
fix2=sitk.SmoothingRecursiveGaussian(fix,1.0)
init=sitk.CenteredTransformInitializer(fix2,mov2,sitk.Euler3DTransform(),sitk.CenteredTransformInitializerFilter.MOMENTS)
best=None
for pitch in ([0,-0.3,0.3,-0.5,0.5] if mod=='ct' else [0]):
    t=sitk.Euler3DTransform(init);t.SetRotation(pitch,0,0)
    R=sitk.ImageRegistrationMethod();R.SetMetricAsMattesMutualInformation(48);R.SetMetricSamplingStrategy(R.RANDOM);R.SetMetricSamplingPercentage(0.05,seed=1)
    R.SetInterpolator(sitk.sitkLinear);R.SetOptimizerAsRegularStepGradientDescent(1.0,1e-4,300,relaxationFactor=0.6);R.SetOptimizerScalesFromPhysicalShift()
    R.SetShrinkFactorsPerLevel([4,2,1]);R.SetSmoothingSigmasPerLevel([2,1,0]);R.SetInitialTransform(t,inPlace=False)
    tr=R.Execute(fix2,mov2);v=R.GetMetricValue();print('pitch0',pitch,'metric',round(v,4),np.round(np.degrees(sitk.Euler3DTransform(tr.GetNthTransform(0) if hasattr(tr,'GetNthTransform') else tr).GetParameters()[:3]),1))
    if best is None or v<best[0]:best=(v,tr)
sitk.WriteTransform(best[1],out);print('best',best[0])
